import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WaitingListStatus } from '@club-manager/shared-types';
import { MEMBER_NOUN_LOWER } from '../../common/brand';
import { ClubsRepository } from '../clubs/clubs.repository';
import { ConsentsService } from '../compliance/consents/consents.service';
import { ConsentStatus, ConsentType } from '../compliance/consents/entities/consent.entity';
import { EmailService } from '../email/email.service';
import { FamiliesRepository } from '../families/families.repository';
import { FamiliesService } from '../families/families.service';
import { MandatesRepository } from '../finance/mandates/mandates.repository';
import { DirectDebitMandateStatus } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { MembersService } from '../members/members.service';
import { SquadsRepository } from '../squads/squads.repository';
import { SquadsService } from '../squads/squads.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { regionForCountry } from '../../common/region/region.util';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListRepository } from './waiting-list.repository';

/**
 * The consents a club asks a new family for. Photography, medical treatment
 * and data sharing with the governing body are the three every British
 * Gymnastics club needs; the rest are opt-in and are asked for as the club
 * needs them rather than at the door.
 */
export const ENROLMENT_CONSENT_TYPES: ConsentType[] = [
  ConsentType.MEDICAL_TREATMENT,
  ConsentType.PHOTOGRAPHY,
  ConsentType.DATA_SHARING,
];

/**
 * What one enrolment actually did. Every optional step reports separately, and
 * anything that did not happen lands in needs_attention with the reason, so a
 * half-done enrolment is visible rather than silent.
 */
export interface EnrolmentResult {
  entry_id: string;
  member_id: string;
  family_id: string;
  family_created: boolean;
  squad_id: string | null;
  squad_assigned: boolean;
  consents_requested: number;
  invite_url: string | null;
  enrolment_email_sent: boolean;
  mandate_email_sent: boolean;
  mandate_already_active: boolean;
  /** Human-readable list of what a person still has to deal with. */
  needs_attention: string[];
}

/**
 * One click from waiting list to billed member (TEM-22, docs/05 rule 3).
 *
 * The single action creates the family (or matches an existing one by parent
 * email), creates the member, gives them the squad place that puts them on the
 * register, raises the consent requests, generates the parent portal invite
 * and starts Direct Debit setup.
 *
 * On partial failure the enrolment does not roll everything back and pretend
 * nothing happened, because the useful half is worth keeping. Instead the two
 * steps that must both hold, family and member, are compensated as a pair: if
 * the member cannot be created and this call created the family, the family is
 * removed again so no orphan is left. Everything after that is reported in
 * needs_attention.
 */
@Injectable()
export class EnrolmentService {
  private readonly logger = new Logger(EnrolmentService.name);
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly waitingList: WaitingListRepository,
    private readonly familiesRepository: FamiliesRepository,
    private readonly familiesService: FamiliesService,
    private readonly membersService: MembersService,
    private readonly squadsService: SquadsService,
    private readonly squadsRepository: SquadsRepository,
    private readonly consentsService: ConsentsService,
    private readonly usersService: UsersService,
    private readonly mandatesRepository: MandatesRepository,
    private readonly emailService: EmailService,
    private readonly clubsRepository: ClubsRepository,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  /**
   * Enrols the child on a waiting list entry.
   *
   * @param entry the entry to enrol, already resolved and club-scoped
   * @param squadId the place they are taking, or null when the club has not
   *   decided yet
   */
  async enrol(entry: WaitingListEntry, squadId: string | null): Promise<EnrolmentResult> {
    if (entry.status === WaitingListStatus.ENROLLED) {
      throw new BadRequestException(
        `${entry.child_first_name} ${entry.child_last_name} is already enrolled`,
      );
    }
    if (!entry.child_gender) {
      throw new BadRequestException(
        `This entry has no gender recorded, which a ${MEMBER_NOUN_LOWER} record needs. ` +
          'Add it to the entry and enrol again.',
      );
    }

    const needsAttention: string[] = [];

    // (a) Match or create the family, by lowercased parent email, exactly as
    // the importer does. A parent enrolling a second child keeps one family.
    const email = entry.parent_email.trim().toLowerCase();
    const existingFamily = await this.familiesRepository.findByPrimaryContactEmail(email);
    let familyId: string;
    let familyCreated = false;
    if (existingFamily) {
      familyId = existingFamily.family_id;
    } else {
      const family = await this.familiesRepository.create({
        family_name: `${entry.child_last_name} Family`,
        primary_contact_name: entry.parent_name,
        primary_contact_email: email,
        ...(entry.parent_phone ? { primary_contact_phone: entry.parent_phone } : {}),
      });
      familyId = family.family_id;
      familyCreated = true;
    }

    // (b) Create the member. If this fails there is nothing worth keeping, so
    // undo a family this call created rather than leaving it stranded.
    let memberId: string;
    try {
      const member = await this.membersService.create({
        family_id: familyId,
        first_name: entry.child_first_name,
        last_name: entry.child_last_name,
        dob: toDateOnly(entry.child_dob),
        gender: entry.child_gender,
        discipline: entry.desired_discipline ?? null,
        ...(squadId ? { squad_id: squadId } : {}),
      });
      memberId = member.member_id;
    } catch (error) {
      if (familyCreated) {
        await this.familiesRepository.remove(familyId).catch((cleanupError) => {
          this.logger.error(
            `Could not remove the family created for a failed enrolment (${familyId})`,
            cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
          );
        });
      }
      throw error;
    }

    // (c) The squad place, which is what puts them on the register. The
    // members row already carries squad_id; assignMember adds the join row the
    // registers and session lists read.
    let squadAssigned = false;
    if (squadId) {
      try {
        await this.squadsService.assignMember(squadId, memberId);
        squadAssigned = true;
      } catch (error) {
        needsAttention.push(
          `The squad place could not be given: ${errorMessage(error)}. ` +
            'Add them to the squad by hand.',
        );
      }
    }

    // (d) Consent requests, raised the way the compliance module raises club
    // consents: a PENDING row per consent type, which the parent grants from
    // the portal. granted_by_user_id is not null in the schema, so a pending
    // request is attributed to the family's parent account where one exists
    // and otherwise to a club administrator, and is rewritten when granted.
    const consentActorId = await this.resolveConsentActor(familyId);
    let consentsRequested = 0;
    if (consentActorId) {
      for (const consentType of ENROLMENT_CONSENT_TYPES) {
        try {
          await this.consentsService.create({
            member_id: memberId,
            consent_type: consentType,
            status: ConsentStatus.PENDING,
            granted_by_user_id: consentActorId,
            notes: 'Requested automatically on enrolment from the waiting list',
          });
          consentsRequested += 1;
        } catch (error) {
          needsAttention.push(
            `The ${consentType} consent request was not raised: ${errorMessage(error)}`,
          );
        }
      }
    } else {
      needsAttention.push(
        'No consent requests were raised because this club has no user account to attribute ' +
          'them to. Raise them from the compliance screen once a parent account exists.',
      );
    }

    // (e) Parent portal invite, so the family can grant those consents and see
    // the register.
    let inviteUrl: string | null = null;
    try {
      const invite = await this.familiesService.generateInvite(familyId);
      inviteUrl = invite.inviteUrl;
    } catch (error) {
      needsAttention.push(
        `The parent portal invite was not created: ${errorMessage(error)}. ` +
          'Send one from the family record.',
      );
    }

    // (f) Direct Debit. A family that already has a live mandate needs nothing;
    // otherwise the mandate setup email goes out with a link to the setup page.
    const activeMandate = await this.mandatesRepository
      .findActiveByFamily(familyId)
      .catch(() => null);
    const mandateAlreadyActive = Boolean(
      activeMandate && activeMandate.status === DirectDebitMandateStatus.ACTIVE,
    );

    const club = await this.clubsRepository.findOne(entry.club_id).catch(() => null);
    const clubName = club?.name ?? 'your club';

    let mandateEmailSent = false;
    if (!mandateAlreadyActive) {
      try {
        await this.emailService.sendMandateSetupRequired({
          familyName: entry.parent_name,
          recipientEmail: entry.parent_email,
          setupUrl: `${this.appUrl}/parent/billing/setup`,
          clubName,
          directDebitScheme: regionForCountry(club?.country).directDebitScheme,
        });
        mandateEmailSent = true;
      } catch (error) {
        needsAttention.push(
          `The Direct Debit setup email did not send: ${errorMessage(error)}. ` +
            'Ask the family to set it up from the parent portal.',
        );
      }
    }

    // The enrolment confirmation, carrying the portal invite.
    let enrolmentEmailSent = false;
    const squad = squadId ? await this.squadsRepository.findOne(squadId).catch(() => null) : null;
    try {
      await this.emailService.sendWaitingListEnrolled({
        recipientEmail: entry.parent_email,
        parentName: entry.parent_name,
        childName: `${entry.child_first_name} ${entry.child_last_name}`,
        clubName,
        squadName: squad?.squad_name ?? null,
        inviteUrl,
        consentsRequested,
        mandateAlreadyActive,
      });
      enrolmentEmailSent = true;
    } catch (error) {
      needsAttention.push(`The enrolment confirmation email did not send: ${errorMessage(error)}`);
    }

    // Finally mark the entry, so the list stops offering places to a child who
    // already has one.
    await this.waitingList.updateEntry(entry.entry_id, {
      status: WaitingListStatus.ENROLLED,
      enrolled_member_id: memberId,
    });

    this.logger.log(
      `Enrolled waiting list entry ${entry.entry_id} as member ${memberId} ` +
        `(family ${familyId}, squad ${squadId ?? 'none'})`,
    );

    return {
      entry_id: entry.entry_id,
      member_id: memberId,
      family_id: familyId,
      family_created: familyCreated,
      squad_id: squadId,
      squad_assigned: squadAssigned,
      consents_requested: consentsRequested,
      invite_url: inviteUrl,
      enrolment_email_sent: enrolmentEmailSent,
      mandate_email_sent: mandateEmailSent,
      mandate_already_active: mandateAlreadyActive,
      needs_attention: needsAttention,
    };
  }

  /**
   * Who a pending consent request is recorded against. The family's own parent
   * account when it has one, otherwise a club administrator, so the request
   * exists and is visible rather than being skipped. Returns null only when the
   * club has no user at all, which the caller reports.
   */
  private async resolveConsentActor(familyId: string): Promise<string | null> {
    const familyUsers = await this.usersService.findByFamily(familyId).catch(() => []);
    const parent = familyUsers.find((user) => user.role === UserRole.PARENT) ?? familyUsers[0];
    if (parent) {
      return parent.user_id;
    }
    const admins = await this.usersService.findByRole(UserRole.SUPER_ADMIN).catch(() => []);
    return admins[0]?.user_id ?? null;
  }
}

/** A date column comes back as a Date or a YYYY-MM-DD string; normalise it. */
function toDateOnly(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
