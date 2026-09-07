import { Injectable, Logger } from '@nestjs/common';
import { FamiliesRepository } from '../families/families.repository';
import { MandatesRepository } from '../finance/mandates/mandates.repository';
import { DirectDebitMandateStatus } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { Family } from '../families/entities/family.entity';
import { CreateFamilyDto } from '../families/dto/create-family.dto';
import { ImportGoCardlessDto } from './dto/import-gocardless.dto';
import {
  GoCardlessCustomerRowDto,
  GoCardlessMandateRowDto,
  GoCardlessPaymentRowDto,
} from './dto/gocardless-import-row.dto';

/** The provider string every mandate written by this importer carries. */
export const GOCARDLESS_PROVIDER = 'gocardless';

/**
 * Bank-debit scheme assumed when the export omits one. Matches both the
 * direct_debit_mandates.scheme column default and regionForCountry('GB'),
 * so an imported UK mandate is indistinguishable from one set up in-app.
 */
export const DEFAULT_MANDATE_SCHEME = 'bacs';

export type GoCardlessCustomerAction = 'create' | 'match' | 'skip' | 'error';
export type GoCardlessMandateAction = 'create' | 'skip' | 'error';

export interface GoCardlessCustomerResult {
  row: number;
  gocardless_customer_id: string;
  email: string | null;
  action: GoCardlessCustomerAction;
  warnings: string[];
  errors: string[];
}

export interface GoCardlessMandateResult {
  row: number;
  gocardless_mandate_id: string;
  gocardless_customer_id: string;
  action: GoCardlessMandateAction;
  status: DirectDebitMandateStatus | null;
  warnings: string[];
  errors: string[];
}

export interface GoCardlessPaymentsSummary {
  /** Payment rows supplied. */
  rows: number;
  /** Rows whose mandate id appears in no supplied mandate row. */
  rows_without_matching_mandate: number;
  /** Totals of the amount column exactly as exported, grouped by currency. */
  totals_by_currency: Array<{ currency: string; rows: number; total_amount: number }>;
  earliest_charge_date: string | null;
  latest_charge_date: string | null;
  /** Always false: see the module comment on why payment history is not written. */
  imported: boolean;
}

export interface GoCardlessPreviewResponse {
  summary: {
    families_to_create: number;
    families_matched: number;
    customers_with_errors: number;
    mandates_to_create: number;
    active_mandates_to_create: number;
    mandates_skipped: number;
    mandates_with_errors: number;
    payments: GoCardlessPaymentsSummary | null;
  };
  customer_results: GoCardlessCustomerResult[];
  mandate_results: GoCardlessMandateResult[];
}

export interface GoCardlessImportOutcomeResponse {
  summary: {
    families_created: number;
    families_matched: number;
    mandates_created: number;
    active_mandates_created: number;
    mandates_skipped: number;
    payments_imported: number;
  };
  errors: Array<{ scope: 'customer' | 'mandate'; row: number; message: string }>;
  warnings: Array<{ scope: 'customer' | 'mandate'; row: number; message: string }>;
}

type MatchedFamily = Pick<Family, 'family_id' | 'family_name' | 'primary_contact_email'>;

interface CustomerPlan {
  row: number; // 1-based position in the submitted customers array
  data: GoCardlessCustomerRowDto;
  email: string | null; // lowercase, null when missing
  errors: string[];
  // A deliberately skipped customer (a duplicated export row, or an unmatched
  // one when the club chose not to create families) is not a failure, so it
  // warns rather than erroring. Only a customer the club cannot act on, such
  // as one with no email at all, is an error.
  warnings: string[];
  action: GoCardlessCustomerAction;
  familyPlan: FamilyPlan | null;
}

interface MandatePlan {
  row: number; // 1-based position in the submitted mandates array
  data: GoCardlessMandateRowDto;
  errors: string[];
  warnings: string[];
  status: DirectDebitMandateStatus | null;
  scheme: string;
  action: GoCardlessMandateAction;
  familyPlan: FamilyPlan | null;
}

interface FamilyPlan {
  email: string; // lowercase primary contact email, the grouping key
  existingFamily: MatchedFamily | null;
  createFamilyDto: CreateFamilyDto;
  /** Provider mandate ids this family already holds with GoCardless. */
  existingProviderMandateIds: Set<string>;
  /** True once an active mandate exists or is claimed by an earlier plan row. */
  hasActiveMandate: boolean;
  mandatePlans: MandatePlan[];
  /** Resolved during import; also lets a later mandate row reuse the family. */
  familyId: string | null;
}

interface GoCardlessPlan {
  familyPlans: FamilyPlan[];
  customerPlans: CustomerPlan[]; // in submitted row order
  mandatePlans: MandatePlan[]; // in submitted row order
  payments: GoCardlessPaymentsSummary | null;
}

/**
 * Takeover of a club's existing GoCardless organisation from its dashboard CSV
 * exports, so a club migrating to this platform keeps every live Direct Debit
 * instead of asking hundreds of parents to re-mandate.
 *
 * What is written: families (matched or created from customers.csv) and
 * direct_debit_mandates rows (from mandates.csv) carrying the GoCardless
 * mandate id, so the existing billing path can collect against them.
 *
 * What is NOT written: payment history. The payments table hangs off invoices
 * (payments.invoice_id is NOT NULL), and a historical GoCardless collection has
 * no invoice in this system; inventing one per payment would corrupt every
 * finance report the club later runs. Payments are therefore summarised for
 * reconciliation and discarded. Importing them properly needs an invoice
 * back-fill design of its own.
 *
 * Collecting against an imported mandate still requires the club's own
 * GoCardless connection to be linked in settings; this importer moves the
 * records, not the API credentials.
 */
@Injectable()
export class GoCardlessTakeoverService {
  private readonly logger = new Logger(GoCardlessTakeoverService.name);

  constructor(
    private readonly familiesRepository: FamiliesRepository,
    private readonly mandatesRepository: MandatesRepository,
  ) {}

  /** Dry run: resolves every row exactly as the import would, writing nothing. */
  async previewGoCardless(dto: ImportGoCardlessDto): Promise<GoCardlessPreviewResponse> {
    const plan = await this.buildPlan(dto);

    let familiesToCreate = 0;
    let familiesMatched = 0;
    for (const familyPlan of plan.familyPlans) {
      if (familyPlan.existingFamily) {
        familiesMatched++;
      } else if (this.familyPlanIsUsed(familyPlan)) {
        familiesToCreate++;
      }
    }

    const creating = plan.mandatePlans.filter((m) => m.action === 'create');

    return {
      summary: {
        families_to_create: familiesToCreate,
        families_matched: familiesMatched,
        customers_with_errors: plan.customerPlans.filter((c) => c.errors.length > 0).length,
        mandates_to_create: creating.length,
        active_mandates_to_create: creating.filter(
          (m) => m.status === DirectDebitMandateStatus.ACTIVE,
        ).length,
        mandates_skipped: plan.mandatePlans.filter((m) => m.action === 'skip').length,
        mandates_with_errors: plan.mandatePlans.filter((m) => m.action === 'error').length,
        payments: plan.payments,
      },
      customer_results: plan.customerPlans.map((customerPlan) => ({
        row: customerPlan.row,
        gocardless_customer_id: customerPlan.data.id,
        email: customerPlan.email,
        action: customerPlan.action,
        warnings: customerPlan.warnings,
        errors: customerPlan.errors,
      })),
      mandate_results: plan.mandatePlans.map((mandatePlan) => ({
        row: mandatePlan.row,
        gocardless_mandate_id: mandatePlan.data.id,
        gocardless_customer_id: mandatePlan.data.customer,
        action: mandatePlan.action,
        status: mandatePlan.status,
        warnings: mandatePlan.warnings,
        errors: mandatePlan.errors,
      })),
    };
  }

  /**
   * Performs the takeover. Per-row failures are collected and reported; the
   * batch is never aborted part-way, mirroring the members import.
   */
  async importGoCardless(dto: ImportGoCardlessDto): Promise<GoCardlessImportOutcomeResponse> {
    const plan = await this.buildPlan(dto);

    let familiesCreated = 0;
    let familiesMatched = 0;
    let mandatesCreated = 0;
    let activeMandatesCreated = 0;
    const mandatesSkipped = plan.mandatePlans.filter((m) => m.action === 'skip').length;
    const errors: GoCardlessImportOutcomeResponse['errors'] = [];
    const warnings: GoCardlessImportOutcomeResponse['warnings'] = [];

    for (const customerPlan of plan.customerPlans) {
      for (const message of customerPlan.errors) {
        errors.push({ scope: 'customer', row: customerPlan.row, message });
      }
      for (const message of customerPlan.warnings) {
        warnings.push({ scope: 'customer', row: customerPlan.row, message });
      }
    }
    for (const mandatePlan of plan.mandatePlans) {
      for (const message of mandatePlan.errors) {
        errors.push({ scope: 'mandate', row: mandatePlan.row, message });
      }
      for (const message of mandatePlan.warnings) {
        warnings.push({ scope: 'mandate', row: mandatePlan.row, message });
      }
    }

    for (const familyPlan of plan.familyPlans) {
      const creatable = familyPlan.mandatePlans.filter((m) => m.action === 'create');
      if (creatable.length === 0) {
        if (familyPlan.existingFamily) {
          familiesMatched++;
        }
        continue;
      }

      if (familyPlan.existingFamily) {
        familyPlan.familyId = familyPlan.existingFamily.family_id;
        familiesMatched++;
      } else {
        try {
          const family = await this.familiesRepository.create(familyPlan.createFamilyDto);
          familyPlan.familyId = family.family_id;
          familiesCreated++;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to create family';
          for (const mandatePlan of creatable) {
            errors.push({ scope: 'mandate', row: mandatePlan.row, message });
          }
          continue;
        }
      }

      for (const mandatePlan of creatable) {
        try {
          await this.mandatesRepository.create(
            this.toCreateMandateFields(mandatePlan, familyPlan.familyId),
          );
          mandatesCreated++;
          if (mandatePlan.status === DirectDebitMandateStatus.ACTIVE) {
            activeMandatesCreated++;
          }
        } catch (error: unknown) {
          errors.push({
            scope: 'mandate',
            row: mandatePlan.row,
            message: error instanceof Error ? error.message : 'Failed to import mandate',
          });
        }
      }
    }

    errors.sort((a, b) => a.row - b.row);
    warnings.sort((a, b) => a.row - b.row);

    this.logger.log(
      `GoCardless takeover complete: ${familiesCreated} families created, ` +
        `${familiesMatched} families matched, ${mandatesCreated} mandates created ` +
        `(${activeMandatesCreated} active), ${mandatesSkipped} skipped, ${errors.length} errors`,
    );

    return {
      summary: {
        families_created: familiesCreated,
        families_matched: familiesMatched,
        mandates_created: mandatesCreated,
        active_mandates_created: activeMandatesCreated,
        mandates_skipped: mandatesSkipped,
        // Always zero. Payment history is a stated non-goal of this importer.
        payments_imported: 0,
      },
      errors,
      warnings,
    };
  }

  /**
   * Resolves every customer, mandate and payment row against current club data
   * without persisting anything. Shared by preview and import so both take
   * identical decisions.
   */
  private async buildPlan(dto: ImportGoCardlessDto): Promise<GoCardlessPlan> {
    const familyPlansByEmail = new Map<string, FamilyPlan>();
    const customerPlans: CustomerPlan[] = [];
    const customerPlansById = new Map<string, CustomerPlan>();

    for (let i = 0; i < dto.customers.length; i++) {
      const data = dto.customers[i];
      const customerPlan: CustomerPlan = {
        row: i + 1,
        data,
        email: null,
        errors: [],
        warnings: [],
        action: 'error',
        familyPlan: null,
      };
      customerPlans.push(customerPlan);

      const customerId = data.id.trim();
      if (customerPlansById.has(customerId)) {
        // A repeated customer id is a duplicated export row, not a second
        // payer. Its mandates still resolve through the first occurrence.
        customerPlan.action = 'skip';
        customerPlan.warnings.push(
          `GoCardless customer ${customerId} appears more than once in this export`,
        );
        continue;
      }
      customerPlansById.set(customerId, customerPlan);

      const email = data.email?.trim().toLowerCase() ?? '';
      if (!email) {
        customerPlan.errors.push(
          `GoCardless customer ${customerId} has no email address, so it cannot be matched to a family`,
        );
        continue;
      }
      customerPlan.email = email;

      let familyPlan = familyPlansByEmail.get(email);
      if (!familyPlan) {
        const existingFamily = await this.familiesRepository.findByPrimaryContactEmail(email);
        familyPlan = {
          email,
          existingFamily,
          createFamilyDto: this.toCreateFamilyDto(data, email),
          existingProviderMandateIds: new Set<string>(),
          hasActiveMandate: false,
          mandatePlans: [],
          familyId: existingFamily?.family_id ?? null,
        };
        if (existingFamily) {
          const held = await this.mandatesRepository.findByFamily(existingFamily.family_id);
          for (const mandate of held) {
            if (mandate.provider === GOCARDLESS_PROVIDER) {
              familyPlan.existingProviderMandateIds.add(mandate.provider_mandate_id);
            }
            if (mandate.status === DirectDebitMandateStatus.ACTIVE) {
              familyPlan.hasActiveMandate = true;
            }
          }
        }
        familyPlansByEmail.set(email, familyPlan);
      }

      customerPlan.familyPlan = familyPlan;
      if (familyPlan.existingFamily) {
        customerPlan.action = 'match';
      } else if (dto.options.create_missing_families) {
        customerPlan.action = 'create';
      } else {
        // The club asked for exactly this: attach mandates only to families it
        // has already imported. Reporting it as an error would tell a club that
        // the takeover half failed when it did what was asked.
        customerPlan.action = 'skip';
        customerPlan.warnings.push(
          `No family matches ${email} and creating missing families is disabled`,
        );
      }
    }

    const mandatePlans: MandatePlan[] = [];
    // Mandate ids claimed earlier in this batch, so a duplicated export row
    // does not trip the (provider, provider_mandate_id) unique at insert time.
    const claimedMandateIds = new Set<string>();

    for (let i = 0; i < dto.mandates.length; i++) {
      const data = dto.mandates[i];
      const mandatePlan: MandatePlan = {
        row: i + 1,
        data,
        errors: [],
        warnings: [],
        status: null,
        scheme: data.scheme?.trim().toLowerCase() || DEFAULT_MANDATE_SCHEME,
        action: 'error',
        familyPlan: null,
      };
      mandatePlans.push(mandatePlan);

      const mandateId = data.id.trim();
      const customerId = data.customer.trim();
      const customerPlan = customerPlansById.get(customerId);

      if (!customerPlan) {
        mandatePlan.errors.push(
          `Mandate ${mandateId} refers to GoCardless customer ${customerId}, ` +
            'which is not in the customers export',
        );
        continue;
      }
      if (!customerPlan.familyPlan) {
        mandatePlan.errors.push(
          `Mandate ${mandateId} cannot be imported because its customer row could not be resolved`,
        );
        continue;
      }
      if (customerPlan.action === 'skip') {
        mandatePlan.action = 'skip';
        mandatePlan.warnings.push(
          `Mandate ${mandateId} skipped because customer ${customerId} was skipped`,
        );
        continue;
      }

      const familyPlan = customerPlan.familyPlan;
      mandatePlan.familyPlan = familyPlan;

      const status = this.toMandateStatus(data.status);
      if (!status) {
        mandatePlan.errors.push(
          `Mandate ${mandateId} has an unrecognised GoCardless status "${data.status}"`,
        );
        continue;
      }
      mandatePlan.status = status;

      if (claimedMandateIds.has(mandateId)) {
        mandatePlan.action = 'skip';
        mandatePlan.warnings.push(
          `Mandate ${mandateId} appears more than once in this export; only the first row is imported`,
        );
        continue;
      }
      if (familyPlan.existingProviderMandateIds.has(mandateId)) {
        mandatePlan.action = 'skip';
        mandatePlan.warnings.push(`Mandate ${mandateId} has already been imported`);
        continue;
      }
      if (status === DirectDebitMandateStatus.ACTIVE && familyPlan.hasActiveMandate) {
        // Mirrors the one-active-mandate-per-family rule MandatesService
        // enforces on create and on redirect-flow setup.
        mandatePlan.action = 'skip';
        mandatePlan.warnings.push(
          `Mandate ${mandateId} skipped: this family already has an active mandate. ` +
            'Cancel the other mandate first if this one should replace it.',
        );
        continue;
      }

      mandatePlan.action = 'create';
      claimedMandateIds.add(mandateId);
      familyPlan.mandatePlans.push(mandatePlan);
      if (status === DirectDebitMandateStatus.ACTIVE) {
        familyPlan.hasActiveMandate = true;
      }
    }

    return {
      familyPlans: Array.from(familyPlansByEmail.values()),
      customerPlans,
      mandatePlans,
      payments: this.summarisePayments(dto.payments, dto.mandates),
    };
  }

  /**
   * Maps a GoCardless mandate status onto ours using exactly the table
   * MandatesService.syncMandateStatus uses, so an imported mandate's status
   * does not change the first time the club syncs or a webhook arrives.
   * Note that GoCardless "expired" lands on CANCELLED for that reason, not on
   * our EXPIRED value, which nothing else in the platform ever writes.
   * An unrecognised status is an error, never a silent default.
   */
  private toMandateStatus(raw: string): DirectDebitMandateStatus | null {
    switch (raw.trim().toLowerCase()) {
      case 'pending_customer_approval':
      case 'pending_submission':
      case 'submitted':
        return DirectDebitMandateStatus.PENDING;
      case 'active':
        return DirectDebitMandateStatus.ACTIVE;
      case 'failed':
        return DirectDebitMandateStatus.FAILED;
      case 'cancelled':
      case 'canceled':
      case 'expired':
      case 'consumed':
        return DirectDebitMandateStatus.CANCELLED;
      default:
        return null;
    }
  }

  private toCreateFamilyDto(data: GoCardlessCustomerRowDto, email: string): CreateFamilyDto {
    const givenName = data.given_name?.trim() ?? '';
    const familyName = data.family_name?.trim() ?? '';
    const companyName = data.company_name?.trim() ?? '';
    const contactName = [givenName, familyName].filter(Boolean).join(' ') || companyName || email;

    return {
      family_name: familyName || companyName || contactName,
      primary_contact_name: contactName,
      primary_contact_email: data.email?.trim() ?? email,
      primary_contact_phone: data.phone_number?.trim() || undefined,
      address_line1: data.address_line1?.trim() || undefined,
      address_line2: data.address_line2?.trim() || undefined,
      city: data.city?.trim() || undefined,
      postcode: data.postal_code?.trim() || undefined,
    };
  }

  /**
   * The mandate row written for an imported mandate.
   *
   * Deliberately the same field set MandatesService.completeRedirectFlow
   * persists (family_id, provider, provider_customer_id, provider_mandate_id,
   * status, scheme), so an imported mandate is indistinguishable from one set
   * up in-app and the existing billing and webhook paths work against it
   * unchanged. club_id is stamped by the repository from the active tenant.
   */
  private toCreateMandateFields(mandatePlan: MandatePlan, familyId: string | null) {
    return {
      family_id: familyId as string,
      provider: GOCARDLESS_PROVIDER,
      provider_customer_id: mandatePlan.data.customer.trim(),
      provider_mandate_id: mandatePlan.data.id.trim(),
      status: mandatePlan.status as DirectDebitMandateStatus,
      scheme: mandatePlan.scheme,
    };
  }

  /** True when at least one mandate row would be written for this family. */
  private familyPlanIsUsed(familyPlan: FamilyPlan): boolean {
    return familyPlan.mandatePlans.some((m) => m.action === 'create');
  }

  /**
   * Reconciliation-only summary of the payments export. Nothing is written:
   * see the class comment. Amounts are summed exactly as exported, so a club
   * can check the total against its GoCardless dashboard.
   */
  private summarisePayments(
    payments: GoCardlessPaymentRowDto[] | undefined,
    mandates: GoCardlessMandateRowDto[],
  ): GoCardlessPaymentsSummary | null {
    if (!payments || payments.length === 0) {
      return null;
    }

    const knownMandateIds = new Set(mandates.map((m) => m.id.trim()));
    const totals = new Map<string, { rows: number; total: number }>();
    let unmatched = 0;
    let earliest: string | null = null;
    let latest: string | null = null;

    for (const payment of payments) {
      const mandateId = payment.mandate?.trim() ?? '';
      if (!mandateId || !knownMandateIds.has(mandateId)) {
        unmatched++;
      }

      const currency = (payment.currency?.trim() || 'GBP').toUpperCase();
      const parsed = Number.parseFloat(payment.amount ?? '');
      const amount = Number.isFinite(parsed) ? parsed : 0;
      const bucket = totals.get(currency) ?? { rows: 0, total: 0 };
      bucket.rows++;
      bucket.total += amount;
      totals.set(currency, bucket);

      const chargeDate = payment.charge_date?.trim();
      if (chargeDate) {
        if (earliest === null || chargeDate < earliest) earliest = chargeDate;
        if (latest === null || chargeDate > latest) latest = chargeDate;
      }
    }

    return {
      rows: payments.length,
      rows_without_matching_mandate: unmatched,
      totals_by_currency: Array.from(totals.entries())
        .map(([currency, bucket]) => ({
          currency,
          rows: bucket.rows,
          // Two decimal places: these are money totals shown back to a treasurer.
          total_amount: Math.round(bucket.total * 100) / 100,
        }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
      earliest_charge_date: earliest,
      latest_charge_date: latest,
      imported: false,
    };
  }
}
