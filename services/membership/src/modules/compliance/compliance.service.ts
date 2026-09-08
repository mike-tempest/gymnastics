import { Injectable, Logger } from '@nestjs/common';
import { DBSService } from './dbs/dbs.service';
import { ConsentsService } from './consents/consents.service';
import { SafeguardingService } from './safeguarding/safeguarding.service';
import { MembersService } from '../members/members.service';

/** Window, in days, within which an expiry counts as needing attention. */
const EXPIRY_WARNING_DAYS = 90;

/** State of a single background check relative to today. */
export type CheckExpiryStatus = 'valid' | 'expiring' | 'expired' | 'unknown';

export interface SafeguardingOfficerSummary {
  name: string;
  role: string;
  email: string;
  phone: string;
  dbsNumber: string;
  dbsExpiry: string;
  /** Days until the officer's own check expires; negative once it has. */
  daysRemaining: number | null;
  checkStatus: CheckExpiryStatus;
}

export interface ComplianceSummary {
  healthScore: number;
  totalMembers: number;
  dbsValid: number;
  dbsExpiringSoon: number;
  dbsExpired: number;
  consentComplete: number;
  consentPartial: number;
  consentMissing: number;
  /** The first officer, kept for callers that only show one. */
  safeguardingOfficer: SafeguardingOfficerSummary | null;
  /** Every safeguarding officer the club has appointed, in creation order. */
  safeguardingOfficers: SafeguardingOfficerSummary[];
  expiringDbsChecks: {
    name: string;
    role: string;
    expiryDate: string;
    daysRemaining: number;
  }[];
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly dbsService: DBSService,
    private readonly consentsService: ConsentsService,
    private readonly safeguardingService: SafeguardingService,
    private readonly membersService: MembersService,
  ) {}

  /**
   * Get compliance summary with aggregated statistics
   * Provides overall health score and key metrics from DBS, Consents, and Safeguarding
   *
   * Every figure here is counted from stored records. Nothing is estimated or
   * extrapolated: a club acting on this screen is acting on its own data.
   */
  async getSummary(): Promise<ComplianceSummary> {
    this.logger.log('Generating compliance summary');

    try {
      // Fetch data from all compliance services in parallel
      const [
        dbsStats,
        consentStats,
        consentCoverage,
        memberStats,
        safeguardingOfficers,
        expiringDbs,
      ] = await Promise.all([
        this.dbsService.getStatistics(),
        this.consentsService.getStatistics(),
        this.consentsService.getCoverage(),
        this.membersService.getStatistics(),
        this.safeguardingService.getOfficers(),
        this.dbsService.getExpiringSoon(EXPIRY_WARNING_DAYS),
      ]);

      // Calculate health score based on compliance metrics
      // Factors: valid DBS (40%), granted consents (40%), expiring DBS (20% penalty)
      const healthScore = this.calculateHealthScore(dbsStats, consentStats);

      // Map expiring DBS checks to summary format
      const expiringDbsChecks = expiringDbs.map((check) => {
        const daysRemaining = this.calculateDaysRemaining(check.expiry_date);
        const fullName = check.user
          ? `${check.user.first_name} ${check.user.last_name}`
          : 'Unknown';
        return {
          name: fullName,
          role: check.user?.role || 'Unknown',
          expiryDate: check.expiry_date?.toISOString() || '',
          daysRemaining: Math.max(0, daysRemaining),
        };
      });

      // Safeguarding officers are appointed rows in their own table, so their
      // own checks are outside the DBS expiry sweep. Surface each officer's
      // expiry state here so a lapsed welfare officer is visible rather than
      // quietly displayed as a date nobody reads.
      const officerSummaries = safeguardingOfficers.map((officer) =>
        this.toOfficerSummary(officer),
      );

      // Consent coverage, counted per member rather than per consent row:
      // complete means every required consent is on file and live, partial
      // means some are, missing means the member has none at all.
      const totalMembers = memberStats.total;
      const consentComplete = consentCoverage.complete;
      const consentPartial = consentCoverage.partial;
      const consentMissing = Math.max(0, totalMembers - consentComplete - consentPartial);

      return {
        healthScore,
        totalMembers,
        dbsValid: dbsStats.valid,
        dbsExpiringSoon: dbsStats.expiringSoon,
        dbsExpired: dbsStats.expired,
        consentComplete,
        consentPartial,
        consentMissing,
        safeguardingOfficer: officerSummaries[0] ?? null,
        safeguardingOfficers: officerSummaries,
        expiringDbsChecks,
      };
    } catch (error) {
      this.logger.error('Error generating compliance summary', error);
      throw error;
    }
  }

  /**
   * Map a stored officer to its summary shape, including the state of the
   * officer's own background check.
   */
  private toOfficerSummary(officer: {
    name: string;
    role: string;
    email: string;
    phone: string | null;
    dbs_number: string | null;
    dbs_expiry: Date | string | null;
  }): SafeguardingOfficerSummary {
    // dbs_expiry is a date-only column and hydrates as a YYYY-MM-DD
    // string under the pg driver; normalise via Date for both shapes.
    const expiry = officer.dbs_expiry ? new Date(officer.dbs_expiry) : null;
    const daysRemaining = expiry ? this.calculateDaysRemaining(expiry) : null;

    return {
      name: officer.name,
      role: officer.role,
      email: officer.email,
      phone: officer.phone || '',
      dbsNumber: officer.dbs_number || '',
      dbsExpiry: expiry ? expiry.toISOString() : '',
      daysRemaining,
      checkStatus: this.checkStatusFor(daysRemaining),
    };
  }

  private checkStatusFor(daysRemaining: number | null): CheckExpiryStatus {
    if (daysRemaining === null) return 'unknown';
    if (daysRemaining < 0) return 'expired';
    if (daysRemaining <= EXPIRY_WARNING_DAYS) return 'expiring';
    return 'valid';
  }

  /**
   * Calculate overall compliance health score (0-100)
   * Based on percentage of valid DBS checks, granted consents, and expiring checks
   */
  private calculateHealthScore(
    dbsStats: { total: number; valid: number; expiringSoon: number; expired: number },
    consentStats: { total: number; granted: number },
  ): number {
    if (dbsStats.total === 0 && consentStats.total === 0) {
      return 0;
    }

    // DBS compliance (40% weight)
    const dbsScore = dbsStats.total > 0 ? (dbsStats.valid / dbsStats.total) * 40 : 0;

    // Consent compliance (40% weight)
    const consentScore =
      consentStats.total > 0 ? (consentStats.granted / consentStats.total) * 40 : 0;

    // Penalty for expiring and expired checks (20% weight)
    const expiringPenalty =
      dbsStats.total > 0 ? ((dbsStats.expiringSoon + dbsStats.expired) / dbsStats.total) * 20 : 0;

    const healthScore = Math.round(dbsScore + consentScore - expiringPenalty);

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, healthScore));
  }

  /**
   * Days remaining until an expiry date. Negative once the date has passed,
   * so a caller can tell "expired last month" from "expires tomorrow".
   */
  private calculateDaysRemaining(expiryDate: Date | null): number {
    if (!expiryDate) {
      return 0;
    }

    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();

    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
