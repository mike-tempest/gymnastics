import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import {
  CREDENTIAL_EXPIRING_SOON_DAYS,
  CREDENTIAL_EXPIRY_WARNING_DAYS,
  CREDENTIAL_TYPE_LABELS,
  CredentialStatus,
  CredentialType,
  daysUntilCredentialExpiry,
  deriveCredentialStatus,
} from '@club-manager/shared-types';
import { CredentialsRepository } from './credentials.repository';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { Credential } from './entities/credential.entity';
import { EmailService } from '../../email/email.service';
import { ClubsService } from '../../clubs/clubs.service';
import { Club } from '../../clubs/entities/club.entity';
import { CLS_CLUB_ID_KEY } from '../../../common/tenancy/tenant-context.service';
import { formatClubDate } from '../../../common/region/format.util';

export interface CredentialStatistics {
  total: number;
  valid: number;
  expiringSoon: number;
  expired: number;
}

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);
  private readonly appUrl: string;

  constructor(
    private readonly credentialsRepository: CredentialsRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly clubsService: ClubsService,
    private readonly cls: ClsService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  async create(createDto: CreateCredentialDto, createdBy: string | null): Promise<Credential> {
    // A credential belongs to a staff member or to a gymnast, never both and
    // never neither. The DTO catches a payload with no subject; a payload with
    // two would otherwise reach the database check constraint as a 500.
    if (Boolean(createDto.user_id) === Boolean(createDto.member_id)) {
      throw new BadRequestException(
        'A credential belongs to either a staff member or a gymnast, not both',
      );
    }

    await this.assertReferenceIsFree(createDto.credential_type, createDto.reference_number);

    const created = await this.credentialsRepository.create(createDto, createdBy);
    // Status follows the expiry date on the way in, so a back-dated record is
    // filed as expired rather than waiting for the overnight sweep.
    const status = deriveCredentialStatus(createDto.expiry_date ?? null);
    if (status !== created.status) {
      await this.credentialsRepository.setStatus(created.credential_id, status);
    }

    const result = await this.credentialsRepository.findOne(created.credential_id);
    if (!result) {
      throw new NotFoundException(`Credential ${created.credential_id} not found after creation`);
    }
    return result;
  }

  async findAll(): Promise<Credential[]> {
    return await this.credentialsRepository.findAll();
  }

  async findOne(id: string): Promise<Credential> {
    const credential = await this.credentialsRepository.findOne(id);
    if (!credential) {
      throw new NotFoundException(`Credential with ID ${id} not found`);
    }
    return credential;
  }

  async findByUser(userId: string): Promise<Credential[]> {
    return await this.credentialsRepository.findByUser(userId);
  }

  async findByMember(memberId: string): Promise<Credential[]> {
    return await this.credentialsRepository.findByMember(memberId);
  }

  async update(id: string, updateDto: UpdateCredentialDto): Promise<Credential> {
    const existing = await this.findOne(id);

    // Correcting a mistyped certificate number is ordinary, and it must not
    // land on the club's unique index as a 500.
    if (updateDto.reference_number && updateDto.reference_number !== existing.reference_number) {
      await this.assertReferenceIsFree(
        updateDto.credential_type ?? existing.credential_type,
        updateDto.reference_number,
        id,
      );
    }

    await this.credentialsRepository.update(id, updateDto);

    // An explicit status in the payload wins; otherwise a changed expiry date
    // re-derives it so the stored status can never contradict the date.
    if (!updateDto.status && 'expiry_date' in updateDto) {
      const status = deriveCredentialStatus(updateDto.expiry_date ?? null);
      await this.credentialsRepository.setStatus(id, status);
    }

    const result = await this.credentialsRepository.findOne(existing.credential_id);
    if (!result) {
      throw new NotFoundException(`Credential with ID ${id} not found after update`);
    }
    return result;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Verify exists (and belongs to the active club)
    await this.credentialsRepository.remove(id);
    this.logger.log(`Credential ${id} deleted`);
  }

  async getExpiringSoon(daysAhead: number = CREDENTIAL_EXPIRING_SOON_DAYS): Promise<Credential[]> {
    const credentials = await this.credentialsRepository.findExpiringWithin(daysAhead);
    return credentials.filter(
      (credential) =>
        credential.expiry_date !== null && daysUntilCredentialExpiry(credential.expiry_date) >= 0,
    );
  }

  async getExpired(): Promise<Credential[]> {
    return await this.credentialsRepository.findExpired();
  }

  /**
   * A certificate number is unique within a club and credential type. The
   * lookup is tenant-scoped, so the same awarding-body reference held by
   * another club is not a clash.
   */
  private async assertReferenceIsFree(
    credentialType: CredentialType,
    referenceNumber: string | null | undefined,
    ignoreCredentialId?: string,
  ): Promise<void> {
    if (!referenceNumber) return;
    const duplicate = await this.credentialsRepository.findByReference(
      credentialType,
      referenceNumber,
    );
    if (duplicate && duplicate.credential_id !== ignoreCredentialId) {
      throw new ConflictException(
        `A ${CREDENTIAL_TYPE_LABELS[credentialType].toLowerCase()} credential with reference ${referenceNumber} already exists`,
      );
    }
  }

  async getStatistics(): Promise<CredentialStatistics> {
    const [total, valid, expiringSoon, expired] = await Promise.all([
      this.credentialsRepository.count(),
      this.credentialsRepository.countByStatus(CredentialStatus.VALID),
      this.credentialsRepository.countByStatus(CredentialStatus.EXPIRING_SOON),
      this.credentialsRepository.countByStatus(CredentialStatus.EXPIRED),
    ]);

    return { total, valid, expiringSoon, expired };
  }

  /**
   * Scheduled job to check for expiring and expired credentials.
   * Runs daily at 2:00 AM.
   * Sends email warnings at 90, 60, 30, 14 and 7 days before expiry.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async checkExpiringCredentials(): Promise<void> {
    this.logger.log('Running scheduled credential expiry check across all clubs...');

    // Background job with no request/CLS context. The repository methods are
    // tenant-scoped, so run the sweep once per club inside a CLS scope.
    const clubs = await this.clubsService.findAll();
    for (const club of clubs) {
      await this.cls.run(async () => {
        this.cls.set(CLS_CLUB_ID_KEY, club.id);
        try {
          await this.checkExpiringCredentialsForClub(club);
        } catch (error) {
          this.logger.error(`Error checking credential expiry for club ${club.id}:`, error);
        }
      });
    }
  }

  private async checkExpiringCredentialsForClub(club: Club): Promise<void> {
    try {
      let expiringSoon = 0;
      let expired = 0;
      let emailsSent = 0;

      // One read covers the whole window: everything expiring within 90 days
      // plus anything already past its date that is not yet marked expired.
      const credentials = await this.credentialsRepository.findExpiringWithin(
        CREDENTIAL_EXPIRING_SOON_DAYS,
      );

      for (const credential of credentials) {
        if (!credential.expiry_date) {
          continue;
        }

        const daysUntilExpiry = daysUntilCredentialExpiry(credential.expiry_date);
        const status = deriveCredentialStatus(credential.expiry_date);

        if (status === CredentialStatus.EXPIRED) {
          expired++;
        } else if (status === CredentialStatus.EXPIRING_SOON) {
          expiringSoon++;
        }

        if (status !== credential.status) {
          await this.credentialsRepository.setStatus(credential.credential_id, status);
          this.logger.warn(
            `Credential ${credential.title} (${credential.credential_id}) is now ${status} ` +
              `(${daysUntilExpiry} days until expiry)`,
          );
        }

        // Warn on the exact cadence days only, so the holder gets five
        // reminders rather than ninety.
        if (CREDENTIAL_EXPIRY_WARNING_DAYS.includes(daysUntilExpiry)) {
          const sent = await this.sendCredentialExpiryWarningEmail(
            credential,
            daysUntilExpiry,
            club,
          ).catch((error) => {
            this.logger.error(
              `Failed to send credential expiry email for ${credential.credential_id}`,
              error,
            );
            return false;
          });
          if (sent) emailsSent++;
        }
      }

      this.logger.log(
        `Credential expiry check complete for club ${club.id}: ${expiringSoon} expiring soon, ` +
          `${expired} expired, ${emailsSent} warning emails sent`,
      );
    } catch (error) {
      this.logger.error('Error checking credential expiry:', error);
    }
  }

  /**
   * Email the holder that their credential is about to lapse. Returns false
   * without sending when the credential belongs to a gymnast rather than a
   * user: members have no login and no address of their own, and their
   * credentials are chased through the family, not by direct email.
   */
  private async sendCredentialExpiryWarningEmail(
    credential: Credential,
    daysUntilExpiry: number,
    club: Club,
  ): Promise<boolean> {
    if (!credential.user?.email) {
      this.logger.warn(
        `No email address for credential ${credential.credential_id}: skipping warning`,
      );
      return false;
    }

    await this.emailService.sendCredentialExpiryWarning({
      firstName: credential.user.first_name,
      lastName: credential.user.last_name,
      recipientEmail: credential.user.email,
      // Named explicitly: without it the template falls back to the
      // instance-wide CLUB_NAME, which is the wrong club on a shared instance.
      clubName: club.name,
      credentialTitle: credential.title,
      credentialType: CREDENTIAL_TYPE_LABELS[credential.credential_type],
      issuingBody: credential.issuing_body ?? undefined,
      referenceNumber: credential.reference_number ?? undefined,
      issueDate: this.formatDate(credential.issue_date, club.locale),
      expiryDate: this.formatDate(credential.expiry_date, club.locale),
      daysUntilExpiry,
      credentialsUrl: `${this.appUrl}/compliance/credentials`,
      contactNumber: this.configService.get<string>('CLUB_CONTACT_NUMBER'),
    });

    this.logger.log(
      `Credential expiry warning email sent to ${credential.user.email} ` +
        `(${daysUntilExpiry} days until expiry)`,
    );
    return true;
  }

  /**
   * Format an issue or expiry date for email display in the club's locale.
   * These are date-only columns parsed as UTC midnight, so they are formatted
   * in UTC: applying the club's timezone would shift the calendar day earlier
   * for clubs west of UTC, showing an expiry a day early.
   */
  private formatDate(date: Date | string | null | undefined, locale: string): string {
    if (!date) return 'N/A';
    const value = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : date;
    return formatClubDate(value, locale, 'UTC', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
}
