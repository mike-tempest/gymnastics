import { Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DBSRepository } from './dbs.repository';
import { CreateDBSCheckDto } from './dto/create-dbs-check.dto';
import { UpdateDBSCheckDto } from './dto/update-dbs-check.dto';
import { DBSCheck, DBSStatus, DBSCheckType } from './entities/dbs-check.entity';
import { EmailService } from '../../email/email.service';
import { ClsService } from 'nestjs-cls';
import { ClubsService } from '../../clubs/clubs.service';
import { Club } from '../../clubs/entities/club.entity';
import { CLS_CLUB_ID_KEY } from '../../../common/tenancy/tenant-context.service';
import { formatClubDate } from '../../../common/region/format.util';
import { GoverningBody, governingBodyConfig } from '@club-manager/shared-types';

@Injectable()
export class DBSService {
  private readonly logger = new Logger(DBSService.name);
  private readonly appUrl: string;

  constructor(
    private readonly dbsRepository: DBSRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly clubsService: ClubsService,
    private readonly cls: ClsService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  async create(createDto: CreateDBSCheckDto, createdBy: string): Promise<DBSCheck> {
    this.logger.log(`Creating DBS check for user ${createDto.user_id}`);

    // Check for existing certificate number
    const existing = await this.dbsRepository.findAll();
    const duplicate = existing.find(
      (check) => check.certificate_number === createDto.certificate_number,
    );

    if (duplicate) {
      // Name the club's own framework: "DBS certificate ..." for GB clubs
      // (unchanged), "WWCC certificate ..." for Australian clubs, and so on.
      const club = await this.clubsService.findCurrent();
      const config = governingBodyConfig(club.governing_body);
      throw new ConflictException(
        `${config.backgroundCheckShortLabel} certificate ${createDto.certificate_number} already exists`,
      );
    }

    // Calculate status based on expiry date
    const dbsCheck = await this.dbsRepository.create(createDto, createdBy);
    await this.updateStatusBasedOnExpiry(dbsCheck.dbs_check_id);

    const created = await this.dbsRepository.findOne(dbsCheck.dbs_check_id);
    if (!created) {
      throw new NotFoundException(`DBS check ${dbsCheck.dbs_check_id} not found after creation`);
    }
    return created;
  }

  async findAll(): Promise<DBSCheck[]> {
    return await this.dbsRepository.findAll();
  }

  async findOne(id: string): Promise<DBSCheck> {
    const dbsCheck = await this.dbsRepository.findOne(id);
    if (!dbsCheck) {
      throw new NotFoundException(`DBS check with ID ${id} not found`);
    }
    return dbsCheck;
  }

  async findByUser(userId: string): Promise<DBSCheck[]> {
    return await this.dbsRepository.findByUser(userId);
  }

  async getLatestForUser(userId: string): Promise<DBSCheck | null> {
    return await this.dbsRepository.findLatestByUser(userId);
  }

  async isUserDBSValid(userId: string): Promise<boolean> {
    const latestCheck = await this.dbsRepository.findLatestByUser(userId);
    return latestCheck ? latestCheck.status === DBSStatus.VALID : false;
  }

  async update(id: string, updateDto: UpdateDBSCheckDto, verifiedBy?: string): Promise<DBSCheck> {
    await this.findOne(id); // Verify exists

    await this.dbsRepository.update(id, updateDto, verifiedBy);

    // Update status based on new expiry date if changed
    if (updateDto.expiry_date) {
      await this.updateStatusBasedOnExpiry(id);
    }

    const result = await this.dbsRepository.findOne(id);
    if (!result) {
      throw new NotFoundException(`DBS check with ID ${id} not found after update`);
    }
    return result;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Verify exists
    await this.dbsRepository.remove(id);
    this.logger.log(`DBS check ${id} deleted`);
  }

  async getExpiringSoon(daysAhead: number = 90): Promise<DBSCheck[]> {
    return await this.dbsRepository.findExpiringSoon(daysAhead);
  }

  async getExpired(): Promise<DBSCheck[]> {
    return await this.dbsRepository.findExpired();
  }

  async getStatistics(): Promise<{
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
    pending: number;
  }> {
    const [total, valid, expiringSoon, expired, pending] = await Promise.all([
      this.dbsRepository.count(),
      this.dbsRepository.countByStatus(DBSStatus.VALID),
      this.dbsRepository.countByStatus(DBSStatus.EXPIRING_SOON),
      this.dbsRepository.countByStatus(DBSStatus.EXPIRED),
      this.dbsRepository.countByStatus(DBSStatus.PENDING),
    ]);

    return { total, valid, expiringSoon, expired, pending };
  }

  /**
   * Update DBS check status based on expiry date
   */
  private async updateStatusBasedOnExpiry(dbsCheckId: string): Promise<void> {
    const dbsCheck = await this.dbsRepository.findOne(dbsCheckId);
    if (!dbsCheck || !dbsCheck.expiry_date) {
      return;
    }

    const today = new Date();
    const expiryDate = new Date(dbsCheck.expiry_date);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry < 0) {
      // Expired
      await this.dbsRepository.markAsExpired(dbsCheckId);
    } else if (daysUntilExpiry <= 90) {
      // Expiring soon (within 90 days)
      await this.dbsRepository.markAsExpiringSoon(dbsCheckId);
    }
  }

  /**
   * Scheduled job to check for expiring/expired DBS checks
   * Runs daily at 2:00 AM
   * Sends email warnings at 90, 60, 30, 14, and 7 days before expiry
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async checkExpiringDBSChecks(): Promise<void> {
    this.logger.log('Running scheduled DBS expiry check across all clubs...');

    // Background job with no request/CLS context. The DBS repo methods are
    // tenant-scoped, so run the sweep once per club inside a CLS scope.
    const clubs = await this.clubsService.findAll();
    for (const club of clubs) {
      await this.cls.run(async () => {
        this.cls.set(CLS_CLUB_ID_KEY, club.id);
        try {
          await this.checkExpiringDBSChecksForClub(club);
        } catch (error) {
          this.logger.error(`Error checking DBS expiry for club ${club.id}:`, error);
        }
      });
    }
  }

  private async checkExpiringDBSChecksForClub(club: Club): Promise<void> {
    try {
      const today = new Date();
      let emailsSent = 0;

      // Find all DBS checks that should be marked as expiring soon
      const expiringSoon = await this.getExpiringSoon(90);
      for (const check of expiringSoon) {
        if (!check.expiry_date || !check.user) {
          continue;
        }

        const expiryDate = new Date(check.expiry_date);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Mark as expiring soon if status is still VALID
        if (check.status === DBSStatus.VALID) {
          await this.dbsRepository.markAsExpiringSoon(check.dbs_check_id);
          this.logger.warn(
            `DBS check ${check.certificate_number} for user ${check.user_id} is expiring soon (${daysUntilExpiry} days)`,
          );
        }

        // Send email warnings at specific intervals: 90, 60, 30, 14, 7 days
        const warningDays = [90, 60, 30, 14, 7];
        if (warningDays.includes(daysUntilExpiry)) {
          this.sendDBSExpiryWarningEmail(check, daysUntilExpiry, club).catch((error) => {
            this.logger.error(
              `Failed to send DBS expiry email for check ${check.dbs_check_id}`,
              error,
            );
          });
          emailsSent++;
        }
      }

      // Find and mark expired checks
      const expired = await this.getExpired();
      for (const check of expired) {
        await this.dbsRepository.markAsExpired(check.dbs_check_id);
        this.logger.warn(
          `DBS check ${check.certificate_number} for user ${check.user_id} has expired`,
        );
      }

      this.logger.log(
        `DBS expiry check complete: ${expiringSoon.length} expiring soon, ${expired.length} expired, ${emailsSent} warning emails sent`,
      );
    } catch (error) {
      this.logger.error('Error checking DBS expiry:', error);
    }
  }

  /**
   * Send DBS expiry warning email
   */
  private async sendDBSExpiryWarningEmail(
    check: DBSCheck,
    daysUntilExpiry: number,
    club: Club,
  ): Promise<void> {
    if (!check.user) {
      this.logger.warn(`Cannot send email for DBS check ${check.dbs_check_id}: user not loaded`);
      return;
    }

    const config = governingBodyConfig(club.governing_body);
    // The DBS Update Service (and the "Disclosure and Barring Service"
    // parenthetical) applies to bodies on the UK DBS framework: Swim England
    // and Swim Wales, but not Scottish Swimming (PVG) or non-GB bodies.
    const usesUpdateService = config.backgroundCheckFramework === 'DBS';
    // The email template and subject always append "Check"/"check" after the
    // framework name, so strip a trailing "Check" from names that already end
    // with it (Working With Children Check) to avoid "... Check Check".
    const frameworkName = config.backgroundCheckFramework.replace(/\s+check$/i, '');
    const checkTypeDisplay = this.formatDBSCheckType(
      check.check_type,
      config,
      club.governing_body_region,
    );
    // No fabricated fallback number: when the club has not configured a
    // contact number the email simply omits the phone line.
    const contactNumber = this.configService.get<string>('CLUB_CONTACT_NUMBER');
    // GB DBS emails keep the previous hardcoded "Certificate Number" label
    // byte-for-byte; other frameworks use their configured label (for
    // Swimming Australia, "Card or application number").
    const certificateNumberLabel = usesUpdateService
      ? 'Certificate Number'
      : config.certificateNumberLabel;

    await this.emailService.sendDBSExpiryWarning({
      firstName: check.user.first_name,
      lastName: check.user.last_name,
      recipientEmail: check.user.email,
      certificateNumber: check.certificate_number,
      certificateNumberLabel,
      checkType: checkTypeDisplay,
      issueDate: this.formatDate(check.issue_date, club.locale),
      expiryDate: this.formatDate(check.expiry_date, club.locale),
      daysUntilExpiry,
      renewalUrl: `${this.appUrl}/compliance/dbs/renew`,
      contactNumber,
      frameworkName,
      safeguardingFramework: this.safeguardingFrameworkWording(club.governing_body, config),
      showUpdateService: usesUpdateService,
    });

    this.logger.log(
      `${config.backgroundCheckFramework} expiry warning email sent to ${check.user.email} ` +
        `(${daysUntilExpiry} days until expiry)`,
    );
  }

  /**
   * Format a background check type for display using the governing body's
   * configured labels, falling back to the raw enum value for a type the body
   * does not list. Where several labels share a value (Australian WWCC
   * variants), the label for the club's own state or territory is preferred.
   * For Swim England this reproduces the previous hardcoded GB labels so
   * existing UK emails are unchanged.
   */
  private formatDBSCheckType(
    checkType: DBSCheckType,
    config: ReturnType<typeof governingBodyConfig>,
    region?: string | null,
  ): string {
    const matches = config.backgroundCheckTypes.filter((type) => type.value === checkType);
    if (matches.length === 0) return checkType;
    const regional = region ? matches.find((type) => type.regions?.includes(region)) : undefined;
    return (regional ?? matches[0]).label;
  }

  /**
   * Safeguarding framework wording for the consequences paragraph. Swim England
   * keeps the exact previous "Swim England Wavepower 2024" string so the GB
   * email stays byte-identical; other bodies use their configured framework
   * name directly.
   */
  private safeguardingFrameworkWording(
    governingBody: string | null | undefined,
    config: ReturnType<typeof governingBodyConfig>,
  ): string {
    if (!governingBody || governingBody === GoverningBody.SWIM_ENGLAND) {
      return 'Swim England Wavepower 2024';
    }
    return config.safeguardingFramework;
  }

  /**
   * Format a DBS issue or expiry date for email display in the club's locale.
   * These are date-only columns (TypeORM type 'date') parsed as UTC midnight,
   * so they are formatted in UTC: applying the club's timezone would shift the
   * calendar day earlier for clubs west of UTC, showing an expiry a day early.
   * With the default en-GB locale the output matches the previous hardcoded
   * formatting, so existing UK clubs are unaffected.
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
