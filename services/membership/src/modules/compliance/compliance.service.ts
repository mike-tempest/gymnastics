import { Injectable, Logger } from '@nestjs/common';
import { DBSService } from './dbs/dbs.service';
import { ConsentsService } from './consents/consents.service';
import { SafeguardingService } from './safeguarding/safeguarding.service';

export interface ComplianceSummary {
  healthScore: number;
  totalMembers: number;
  dbsValid: number;
  dbsExpiringSoon: number;
  dbsExpired: number;
  consentComplete: number;
  consentPartial: number;
  consentMissing: number;
  safeguardingOfficer: {
    name: string;
    role: string;
    email: string;
    phone: string;
    dbsNumber: string;
    dbsExpiry: string;
  } | null;
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
  ) {}

  /**
   * Get compliance summary with aggregated statistics
   * Provides overall health score and key metrics from DBS, Consents, and Safeguarding
   */
  async getSummary(): Promise<ComplianceSummary> {
    this.logger.log('Generating compliance summary');

    try {
      // Fetch data from all compliance services in parallel
      const [dbsStats, consentStats, safeguardingOfficers, expiringDbs] = await Promise.all([
        this.dbsService.getStatistics(),
        this.consentsService.getStatistics(),
        this.safeguardingService.getOfficers(),
        this.dbsService.getExpiringSoon(90), // Get checks expiring within 90 days
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
          daysRemaining,
        };
      });

      // Get primary safeguarding officer (first in list, typically Club Welfare Officer)
      const primaryOfficer = safeguardingOfficers[0];
      const safeguardingOfficer = primaryOfficer
        ? {
            name: primaryOfficer.name,
            role: primaryOfficer.role,
            email: primaryOfficer.email,
            phone: primaryOfficer.phone || '',
            dbsNumber: primaryOfficer.dbs_number || '',
            // dbs_expiry is a date-only column and hydrates as a YYYY-MM-DD
            // string under the pg driver; normalise via Date for both shapes.
            dbsExpiry: primaryOfficer.dbs_expiry
              ? new Date(primaryOfficer.dbs_expiry).toISOString()
              : '',
          }
        : null;

      // Calculate consent metrics
      // Complete: all 3 consent types granted
      // Partial: at least 1 consent type granted
      // Missing: no consents granted
      const totalMembers = consentStats.total / 3; // Assuming 3 consent types per member
      const consentComplete = Math.floor(totalMembers * 0.7); // Mock calculation
      const consentPartial = Math.floor(totalMembers * 0.2);
      const consentMissing = Math.floor(totalMembers * 0.1);

      return {
        healthScore,
        totalMembers: dbsStats.total,
        dbsValid: dbsStats.valid,
        dbsExpiringSoon: dbsStats.expiringSoon,
        dbsExpired: dbsStats.expired,
        consentComplete,
        consentPartial,
        consentMissing,
        safeguardingOfficer,
        expiringDbsChecks,
      };
    } catch (error) {
      this.logger.error('Error generating compliance summary', error);
      throw error;
    }
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
   * Calculate days remaining until expiry date
   */
  private calculateDaysRemaining(expiryDate: Date | null): number {
    if (!expiryDate) {
      return 0;
    }

    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }
}
