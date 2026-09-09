import { Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { ConsentsRepository } from './consents.repository';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { Consent, ConsentType, ConsentStatus } from './entities/consent.entity';
import { EmailService } from '../../email/email.service';
import { ClubsService } from '../../clubs/clubs.service';
import { CLS_CLUB_ID_KEY } from '../../../common/tenancy/tenant-context.service';
import { formatClubDate } from '../../../common/region/format.util';
import { governingBodyConfig } from '@club-manager/shared-types';

/**
 * The consent types a member is expected to have on file before they train.
 * Everything else (transport, newsletter, social media, wellbeing tracking) is
 * genuinely optional, so counting it would drag every club's consent figures
 * down for no safeguarding reason. This list is the same three the consent
 * register treats as a complete record.
 */
export const REQUIRED_MEMBER_CONSENT_TYPES: ConsentType[] = [
  ConsentType.MEDICAL_TREATMENT,
  ConsentType.PHOTOGRAPHY,
  ConsentType.DATA_SHARING,
];

/**
 * Per-member consent coverage across the required consent types.
 * `complete` holds all of them, `partial` holds at least one but not all.
 * Members with none on file are not counted here; the caller derives them
 * from the club's member total.
 */
export interface ConsentCoverage {
  requiredTypes: number;
  complete: number;
  partial: number;
}

@Injectable()
export class ConsentsService {
  private readonly logger = new Logger(ConsentsService.name);
  private readonly appUrl: string;

  constructor(
    private readonly consentsRepository: ConsentsRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly clubsService: ClubsService,
    private readonly cls: ClsService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  async create(createDto: CreateConsentDto): Promise<Consent> {
    this.logger.log(`Creating consent ${createDto.consent_type} for member ${createDto.member_id}`);

    // Check if member already has this consent type
    const existing = await this.consentsRepository.findByMemberAndType(
      createDto.member_id,
      createDto.consent_type,
    );

    if (existing && existing.status === ConsentStatus.GRANTED) {
      throw new ConflictException(`Member already has a ${createDto.consent_type} consent`);
    }

    return await this.consentsRepository.create(createDto);
  }

  async findAll(): Promise<Consent[]> {
    return await this.consentsRepository.findAll();
  }

  async findOne(id: string): Promise<Consent> {
    const consent = await this.consentsRepository.findOne(id);
    if (!consent) {
      throw new NotFoundException(`Consent with ID ${id} not found`);
    }
    return consent;
  }

  async findByMember(memberId: string): Promise<Consent[]> {
    return await this.consentsRepository.findByMember(memberId);
  }

  async getMemberConsentStatus(memberId: string): Promise<Record<ConsentType, boolean>> {
    const consents = await this.findByMember(memberId);

    const status: Record<ConsentType, boolean> = {
      [ConsentType.PHOTOGRAPHY]: false,
      [ConsentType.VIDEO]: false,
      [ConsentType.MEDICAL_TREATMENT]: false,
      [ConsentType.DATA_SHARING]: false,
      [ConsentType.TRANSPORT]: false,
      [ConsentType.SOCIAL_MEDIA]: false,
      [ConsentType.NEWSLETTER]: false,
      [ConsentType.CONTACT]: false,
      [ConsentType.WELLBEING_CYCLE_TRACKING]: false,
    };

    // Get latest consent for each type
    for (const type of Object.values(ConsentType)) {
      const typeConsents = consents.filter((c) => c.consent_type === type);
      if (typeConsents.length > 0) {
        // Get most recent
        const latest = typeConsents[0];
        status[type] = latest.status === ConsentStatus.GRANTED;
      }
    }

    return status;
  }

  async hasConsent(memberId: string, consentType: ConsentType): Promise<boolean> {
    const consent = await this.consentsRepository.findByMemberAndType(memberId, consentType);

    if (!consent) return false;

    // Check if expired
    if (consent.expiry_date) {
      const today = new Date();
      const expiryDate = new Date(consent.expiry_date);
      if (expiryDate < today) {
        return false;
      }
    }

    return consent.status === ConsentStatus.GRANTED;
  }

  async findByType(consentType: ConsentType): Promise<Consent[]> {
    return await this.consentsRepository.findByType(consentType);
  }

  async getPendingConsents(): Promise<Consent[]> {
    return await this.consentsRepository.findPendingConsents();
  }

  async getExpiringConsents(daysAhead: number = 30): Promise<Consent[]> {
    return await this.consentsRepository.findExpiringConsents(daysAhead);
  }

  async update(id: string, updateDto: UpdateConsentDto): Promise<Consent> {
    await this.findOne(id); // Verify exists
    const updated = await this.consentsRepository.update(id, updateDto);
    if (!updated) {
      throw new NotFoundException(`Consent with ID ${id} not found after update`);
    }
    return updated;
  }

  async revokeConsent(id: string, revokedBy: string): Promise<Consent> {
    const consent = await this.findOne(id);

    if (consent.status !== ConsentStatus.GRANTED) {
      throw new ConflictException('Can only revoke granted consents');
    }

    this.logger.warn(`Consent ${id} (${consent.consent_type}) revoked by user ${revokedBy}`);

    const revoked = await this.consentsRepository.revokeConsent(id, revokedBy);
    if (!revoked) {
      throw new NotFoundException(`Consent with ID ${id} not found after revocation`);
    }
    return revoked;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Verify exists
    await this.consentsRepository.remove(id);
    this.logger.log(`Consent ${id} deleted`);
  }

  async getStatistics(): Promise<{
    total: number;
    granted: number;
    denied: number;
    pending: number;
    revoked: number;
    byType: Record<ConsentType, number>;
  }> {
    const [total, granted, denied, pending, revoked] = await Promise.all([
      this.consentsRepository.count(),
      this.consentsRepository.countByStatus(ConsentStatus.GRANTED),
      this.consentsRepository.countByStatus(ConsentStatus.DENIED),
      this.consentsRepository.countByStatus(ConsentStatus.PENDING),
      this.consentsRepository.countByStatus(ConsentStatus.REVOKED),
    ]);

    const byType: Record<ConsentType, number> = {} as Record<ConsentType, number>;
    for (const type of Object.values(ConsentType)) {
      byType[type] = await this.consentsRepository.countByType(type);
    }

    return { total, granted, denied, pending, revoked, byType };
  }

  /**
   * Counts how many members hold a complete or partial set of the required
   * consents. Both figures come from the consent rows themselves, one row per
   * member per type, so they move only when a club's actual consent records do.
   */
  async getCoverage(): Promise<ConsentCoverage> {
    const perMember = await this.consentsRepository.countGrantedConsentTypesPerMember(
      REQUIRED_MEMBER_CONSENT_TYPES,
    );

    let complete = 0;
    let partial = 0;
    for (const { grantedTypes } of perMember) {
      if (grantedTypes >= REQUIRED_MEMBER_CONSENT_TYPES.length) {
        complete++;
      } else if (grantedTypes > 0) {
        partial++;
      }
    }

    return { requiredTypes: REQUIRED_MEMBER_CONSENT_TYPES.length, complete, partial };
  }

  /**
   * Scheduled job to check for expired and expiring consents
   * Runs daily at 3:00 AM
   * Sends email warnings at 30, 14, and 7 days before expiry
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async checkExpiredConsents(): Promise<void> {
    this.logger.log('Running scheduled consent expiry check across all clubs...');

    // This is a background job with no request/CLS context. The consent repo
    // methods are tenant-scoped, so run the sweep once per club inside a CLS
    // scope that sets that club's id. Each club's data stays isolated.
    const clubs = await this.clubsService.findAll();
    for (const club of clubs) {
      await this.cls.run(async () => {
        this.cls.set(CLS_CLUB_ID_KEY, club.id);
        try {
          await this.checkExpiredConsentsForClub(club.locale, club.governing_body);
        } catch (error) {
          this.logger.error(`Error checking consent expiry for club ${club.id}:`, error);
        }
      });
    }
  }

  private async checkExpiredConsentsForClub(
    locale: string,
    governingBody: string | null,
  ): Promise<void> {
    try {
      const today = new Date();
      const complianceRequirements = this.buildComplianceRequirements(governingBody);
      let emailsSent = 0;

      // Find consents expiring within 30 days
      const expiringConsents = await this.getExpiringConsents(30);

      // Group consents by parent and member
      const consentsByParentAndMember = this.groupConsentsByParentAndMember(expiringConsents);

      // Send warning emails for each parent-member combination
      for (const key of Object.keys(consentsByParentAndMember)) {
        const group = consentsByParentAndMember[key];

        // Check if any consent is at a warning threshold (30, 14, 7 days)
        const shouldSendWarning = group.consents.some((consent) => {
          if (!consent.expiry_date) return false;
          const daysUntilExpiry = this.calculateDaysUntilExpiry(consent.expiry_date);
          return [30, 14, 7].includes(daysUntilExpiry);
        });

        if (shouldSendWarning) {
          this.sendConsentExpiryWarningEmail(
            group,
            locale,
            complianceRequirements,
            governingBody,
          ).catch((error) => {
            this.logger.error(
              `Failed to send consent expiry email for member ${group.member.member_id}`,
              error,
            );
          });
          emailsSent++;
        }
      }

      // Find and mark expired consents
      const expiredConsents = await this.consentsRepository
        .findAll()
        .then((consents) =>
          consents.filter(
            (c) =>
              c.expiry_date &&
              new Date(c.expiry_date) < today &&
              c.status === ConsentStatus.GRANTED,
          ),
        );

      for (const consent of expiredConsents) {
        await this.consentsRepository.update(consent.consent_id, {
          status: ConsentStatus.EXPIRED,
        });

        this.logger.warn(
          `Consent ${consent.consent_id} (${consent.consent_type}) for member ${consent.member_id} has expired`,
        );
      }

      this.logger.log(
        `Consent expiry check complete: ${expiringConsents.length} expiring, ${expiredConsents.length} expired, ${emailsSent} warning emails sent`,
      );
    } catch (error) {
      this.logger.error('Error checking consent expiry:', error);
    }
  }

  /**
   * Group consents by parent (granted_by) and member
   */
  private groupConsentsByParentAndMember(consents: Consent[]): Record<
    string,
    {
      parent: Consent['granted_by'];
      member: Consent['member'];
      consents: Consent[];
    }
  > {
    const grouped: Record<
      string,
      {
        parent: Consent['granted_by'];
        member: Consent['member'];
        consents: Consent[];
      }
    > = {};

    for (const consent of consents) {
      if (!consent.granted_by || !consent.member) {
        continue;
      }

      const key = `${consent.granted_by_user_id}-${consent.member_id}`;

      if (!grouped[key]) {
        grouped[key] = {
          parent: consent.granted_by,
          member: consent.member,
          consents: [],
        };
      }

      grouped[key].consents.push(consent);
    }

    return grouped;
  }

  /**
   * Send consent expiry warning email to parent
   */
  private async sendConsentExpiryWarningEmail(
    group: {
      parent: Consent['granted_by'];
      member: Consent['member'];
      consents: Consent[];
    },
    locale: string,
    complianceRequirements: string,
    governingBody: string | null,
  ): Promise<void> {
    if (!group.parent || !group.member) {
      this.logger.warn('Cannot send consent expiry email: missing parent or member data');
      return;
    }

    // Sort consents by expiry date to find the nearest one
    const sortedConsents = group.consents
      .filter((c) => c.expiry_date)
      .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());

    if (sortedConsents.length === 0) {
      return;
    }

    const nearestExpiry = sortedConsents[0].expiry_date;
    const { dataSharingRecipient } = governingBodyConfig(governingBody);
    const expiringConsents = sortedConsents.map((consent) => ({
      name: this.formatConsentType(consent.consent_type, dataSharingRecipient),
      icon: this.getConsentIcon(consent.consent_type),
      expiryDate: this.formatDate(consent.expiry_date, locale),
    }));

    await this.emailService.sendConsentExpiryWarning({
      parentName: `${group.parent.first_name} ${group.parent.last_name}`,
      recipientEmail: group.parent.email,
      memberName: `${group.member.first_name} ${group.member.last_name}`,
      memberDOB: this.formatDate(group.member.dob, locale),
      squadName: 'Squad', // Would need to load squad relation for actual name
      expiringCount: sortedConsents.length,
      multipleExpiring: sortedConsents.length > 1,
      nearestExpiry: nearestExpiry ? this.formatDate(nearestExpiry, locale) : undefined,
      expiringConsents,
      complianceRequirements,
      consentUrl: `${this.appUrl}/consents/renew`,
    });

    this.logger.log(
      `Consent expiry warning email sent to ${group.parent.email} for member ${group.member.first_name} ${group.member.last_name}`,
    );
  }

  /**
   * Calculate days until expiry
   */
  private calculateDaysUntilExpiry(expiryDate: Date): number {
    const today = new Date();
    const expiry = new Date(expiryDate);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Format consent type for display. Data sharing names the governing body
   * the data actually goes to (e.g. "Data Sharing with Swimming Australia").
   */
  private formatConsentType(consentType: ConsentType, dataSharingRecipient?: string): string {
    if (consentType === ConsentType.DATA_SHARING && dataSharingRecipient) {
      return `Data Sharing with ${dataSharingRecipient}`;
    }
    const typeMap = {
      [ConsentType.PHOTOGRAPHY]: 'Photography',
      [ConsentType.VIDEO]: 'Video Recording',
      [ConsentType.MEDICAL_TREATMENT]: 'Medical Treatment',
      [ConsentType.DATA_SHARING]: 'Data Sharing',
      [ConsentType.TRANSPORT]: 'Transport',
      [ConsentType.SOCIAL_MEDIA]: 'Social Media',
      [ConsentType.NEWSLETTER]: 'Newsletter',
      [ConsentType.CONTACT]: 'Contact',
      [ConsentType.WELLBEING_CYCLE_TRACKING]: 'Wellbeing Cycle Tracking',
    };
    return typeMap[consentType] || consentType;
  }

  /**
   * Get icon for consent type
   */
  private getConsentIcon(consentType: ConsentType): string {
    const iconMap = {
      [ConsentType.PHOTOGRAPHY]: '📸',
      [ConsentType.VIDEO]: '🎥',
      [ConsentType.MEDICAL_TREATMENT]: '🏥',
      [ConsentType.DATA_SHARING]: '📊',
      [ConsentType.TRANSPORT]: '🚗',
      [ConsentType.SOCIAL_MEDIA]: '💬',
      [ConsentType.NEWSLETTER]: '📧',
      [ConsentType.CONTACT]: '📞',
      [ConsentType.WELLBEING_CYCLE_TRACKING]: '💚',
    };
    return iconMap[consentType] || '📄';
  }

  /**
   * Build the "to remain compliant with ..." fragment for the consent expiry
   * email, keyed on the club's governing body. Each country cites its actual
   * privacy law: GDPR for Great Britain and Ireland, the Privacy Act 1988 for
   * Australia, PIPEDA for Canada, and generic wording elsewhere. The
   * safeguarding framework name comes from the governing-body config. For a
   * Swim England club the output is the previous hardcoded string
   * byte-for-byte, so existing UK clubs are unaffected.
   */
  private buildComplianceRequirements(governingBody: string | null): string {
    const config = governingBodyConfig(governingBody);
    const privacyLawByCountry: Record<string, string> = {
      GB: 'GDPR',
      IE: 'GDPR',
      AU: 'the Privacy Act 1988 (Australian Privacy Principles)',
      CA: 'PIPEDA',
    };
    const privacyLaw = privacyLawByCountry[config.country] ?? 'applicable privacy law';
    return `${privacyLaw} and ${config.label} ${config.safeguardingFramework} requirements`;
  }

  /**
   * Format a consent expiry or date-of-birth for email display in the club's
   * locale. These are date-only columns (TypeORM type 'date') parsed as UTC
   * midnight, so they are formatted in UTC: applying the club's timezone would
   * shift the calendar day earlier for clubs west of UTC, showing an expiry a
   * day early. With the default en-GB locale the output matches the previous
   * hardcoded formatting, so existing UK clubs are unaffected.
   */
  private formatDate(date: Date | null | undefined, locale: string): string {
    if (!date) return 'N/A';
    return formatClubDate(date, locale, 'UTC', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
}
