import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { FeeStructuresRepository } from '../fee-structures/fee-structures.repository';
import {
  AppliesToType,
  FeeFrequency,
  FeeStructure,
} from '../fee-structures/entities/fee-structure.entity';
import { PaymentsService } from '../payments/payments.service';
import { EmailService } from '../../email/email.service';
import { FamiliesRepository } from '../../families/families.repository';
import { Family } from '../../families/entities/family.entity';
import { SwimmersRepository } from '../../swimmers/swimmers.repository';
import { Swimmer } from '../../swimmers/entities/swimmer.entity';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { formatClubDate, formatMoney, roundTo2dp } from '../../../common/region/format.util';
import {
  regionForCountry,
  taxRegistrationLabelForCountry,
} from '../../../common/region/region.util';
import { Club } from '../../clubs/entities/club.entity';

/** Result of an invoice-generation run for a single fee structure. */
export interface InvoiceGenerationSummary {
  created: number;
  skipped: number;
  invoices: Invoice[];
}

/** A family in scope for a fee structure, with the swimmers that put it there. */
interface ScopeEntry {
  family: Family;
  swimmers: Swimmer[];
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly invoicesRepository: InvoicesRepository,
    private readonly feeStructuresRepository: FeeStructuresRepository,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly familiesRepository: FamiliesRepository,
    private readonly swimmersRepository: SwimmersRepository,
    private readonly clubsRepository: ClubsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Resolve the owning club's billing currency so the invoice records the
    // currency its amounts are denominated in. Falls back to GBP, so a club with
    // the default currency (every existing UK club) is unaffected.
    const club = await this.clubsRepository.findOne(this.tenantContext.getClubId());
    const region = regionForCountry(club?.country);
    const currency = club?.currency ?? region.currency;
    const locale = club?.locale ?? region.locale;

    // Create the invoice
    const invoice = await this.invoicesRepository.create(createInvoiceDto, invoiceNumber, currency);

    // Create invoice items if provided
    if (createInvoiceDto.items && createInvoiceDto.items.length > 0) {
      for (const itemDto of createInvoiceDto.items) {
        await this.invoicesRepository.createInvoiceItem(invoice.invoice_id, itemDto);
      }

      // Recalculate totals. The club is already loaded above, so pass it in to
      // avoid a second lookup when applying the tax rate.
      await this.recalculateTotals(invoice.invoice_id, club);
    }

    const createdInvoice = await this.findOne(invoice.invoice_id);

    // Send invoice created email to family
    try {
      const family = await this.familiesRepository.findOne(createdInvoice.family_id);
      if (family && family.primary_contact_email) {
        await this.emailService.sendInvoiceCreated({
          familyName: family.family_name,
          recipientEmail: family.primary_contact_email,
          invoiceNumber: createdInvoice.invoice_number,
          // issued_date and due_date are date-only columns (stored as UTC
          // midnight), so render them in UTC: the stored calendar date must
          // appear as-is for every club and never shift with the club timezone.
          invoiceDate: formatClubDate(createdInvoice.issued_date, locale, 'UTC'),
          dueDate: formatClubDate(createdInvoice.due_date, locale, 'UTC'),
          totalAmount: formatMoney(createdInvoice.total_amount, currency, locale),
          ...this.buildTaxEmailFields(createdInvoice, club, currency, locale),
          items:
            createdInvoice.items?.map((item) => ({
              description: item.description,
              amount: formatMoney(item.total, currency, locale),
            })) || [],
        });
        this.logger.log(
          `Invoice created email sent to ${family.primary_contact_email} for invoice ${createdInvoice.invoice_number}`,
        );
      } else {
        this.logger.warn(
          `Cannot send invoice email for invoice ${createdInvoice.invoice_number}: family not found or no email address`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send invoice created email for invoice ${createdInvoice.invoice_id}: ${err.message}`,
        err.stack,
      );
      // Don't fail invoice creation if email sending fails
    }

    // Automatically attempt to collect payment via Direct Debit if family has active mandate
    try {
      const payment = await this.paymentsService.collectDirectDebitPayment(
        createdInvoice.invoice_id,
      );
      if (payment) {
        this.logger.log(
          `Automatically initiated payment collection for invoice ${createdInvoice.invoice_id}`,
        );
      } else {
        this.logger.log(
          `No automatic payment collection for invoice ${createdInvoice.invoice_id} (no active mandate or already paid)`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to automatically collect payment for invoice ${createdInvoice.invoice_id}: ${err.message}`,
        err.stack,
      );
      // Don't fail invoice creation if payment collection fails
    }

    return createdInvoice;
  }

  async findAll(): Promise<Invoice[]> {
    return await this.invoicesRepository.findAll();
  }

  async findByFamily(familyId: string): Promise<Invoice[]> {
    return await this.invoicesRepository.findByFamily(familyId);
  }

  async findByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return await this.invoicesRepository.findByStatus(status);
  }

  async findOverdue(): Promise<Invoice[]> {
    return await this.invoicesRepository.findOverdue();
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return invoice;
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    await this.findOne(id); // This will throw if not found
    const updated = await this.invoicesRepository.update(id, updateInvoiceDto);
    if (!updated) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.invoicesRepository.remove(id);
  }

  /**
   * Generates this month's invoices for every active monthly fee structure,
   * optionally filtered to fee structures scoped to one squad. Each fee runs
   * through the same engine as POST /invoices/generate, so re-running within
   * the same calendar month (in the club's timezone) creates nothing new.
   * Returns the created invoices, preserving the historical route contract.
   */
  async generateMonthlyInvoices(squadId?: string): Promise<Invoice[]> {
    // Get all active monthly fee structures
    const monthlyFees = await this.feeStructuresRepository.findAll();
    let activeFees = monthlyFees.filter(
      (fee) => fee.active && fee.frequency === FeeFrequency.MONTHLY,
    );

    // If a squad_id is provided, filter fee structures to that squad only
    if (squadId) {
      activeFees = activeFees.filter((fee) => fee.applies_to_id === squadId);
      this.logger.log(
        `Generating monthly invoices filtered to squad ${squadId} (${activeFees.length} fee structures)`,
      );
    }

    const invoices: Invoice[] = [];
    for (const fee of activeFees) {
      const summary = await this.generateForFeeStructure(fee);
      invoices.push(...summary.invoices);
    }
    return invoices;
  }

  /**
   * Generates invoices for one fee structure: one invoice per family in scope,
   * created through the standard create() path so emails, automatic Direct
   * Debit collection and tax behave exactly as they do for manual invoices.
   *
   * Idempotency: every generated invoice records the fee structure and a
   * billing period key. Families that already have a non-cancelled invoice for
   * this fee structure and period are skipped and counted in the summary, so
   * the endpoint can be re-run safely. When periodKey is omitted it is derived
   * from the fee frequency (see deriveBillingPeriod); term fees normally
   * receive an explicit label such as 'Term 1 2027' from the caller.
   */
  async generateInvoicesForFeeStructure(
    feeStructureId: string,
    periodKey?: string,
  ): Promise<InvoiceGenerationSummary> {
    const fee = await this.feeStructuresRepository.findOne(feeStructureId);
    if (!fee) {
      throw new NotFoundException(`Fee structure with ID ${feeStructureId} not found`);
    }
    if (!fee.active) {
      throw new BadRequestException('Cannot generate invoices for an inactive fee structure');
    }
    return await this.generateForFeeStructure(fee, periodKey);
  }

  private async generateForFeeStructure(
    fee: FeeStructure,
    periodKey?: string,
  ): Promise<InvoiceGenerationSummary> {
    const club = await this.clubsRepository.findOne(this.tenantContext.getClubId());
    const timezone = club?.timezone ?? 'Europe/London';
    const billingPeriod = periodKey?.trim() || this.deriveBillingPeriod(fee, timezone);

    const scope = await this.resolveScope(fee);
    const existing = await this.invoicesRepository.findByFeeStructureAndPeriod(
      fee.fee_structure_id,
      billingPeriod,
    );
    const alreadyInvoiced = new Set(existing.map((invoice) => invoice.family_id));

    const issuedDate = this.clubToday(timezone);
    const dueDate = this.addDays(issuedDate, 14); // Due in 14 days

    const invoices: Invoice[] = [];
    let skipped = 0;

    for (const entry of scope) {
      if (alreadyInvoiced.has(entry.family.family_id)) {
        skipped++;
        continue;
      }

      // amount is a decimal column, so TypeORM returns it as a string.
      const amount = Number(fee.amount);
      const items =
        fee.applies_to_type === AppliesToType.CLUB
          ? // Club-wide fee: one line item per family.
            [
              {
                description: fee.name,
                unit_price: amount,
                quantity: 1,
                fee_structure_id: fee.fee_structure_id,
              },
            ]
          : // Squad or swimmer fee: one line item per swimmer in scope.
            entry.swimmers.map((swimmer) => ({
              description: `${fee.name} - ${swimmer.first_name} ${swimmer.last_name}`,
              unit_price: amount,
              quantity: 1,
              fee_structure_id: fee.fee_structure_id,
            }));

      const invoice = await this.create({
        family_id: entry.family.family_id,
        issued_date: issuedDate,
        due_date: dueDate,
        fee_structure_id: fee.fee_structure_id,
        billing_period: billingPeriod,
        items,
      } as CreateInvoiceDto);
      invoices.push(invoice);
    }

    this.logger.log(
      `Invoice generation for fee structure ${fee.fee_structure_id} (${billingPeriod}): ` +
        `${invoices.length} created, ${skipped} skipped`,
    );

    return { created: invoices.length, skipped, invoices };
  }

  /**
   * Resolves the families a fee structure applies to, along with the swimmers
   * that place each family in scope (used to build per-swimmer line items).
   */
  private async resolveScope(fee: FeeStructure): Promise<ScopeEntry[]> {
    switch (fee.applies_to_type) {
      case AppliesToType.CLUB: {
        // Club-wide fee: every family in the club.
        const families = await this.familiesRepository.findAll();
        return families.map((family) => ({ family, swimmers: [] }));
      }

      case AppliesToType.SQUAD: {
        if (!fee.applies_to_id) {
          throw new BadRequestException('Squad fee structure has no squad assigned');
        }
        // Families with at least one swimmer in the squad, one entry each.
        const swimmers = await this.swimmersRepository.findBySquadId(fee.applies_to_id);
        const swimmersByFamily = new Map<string, Swimmer[]>();
        for (const swimmer of swimmers) {
          if (!swimmer.family_id) {
            // A swimmer without a family cannot be invoiced; skip them.
            continue;
          }
          const list = swimmersByFamily.get(swimmer.family_id) ?? [];
          list.push(swimmer);
          swimmersByFamily.set(swimmer.family_id, list);
        }
        const entries: ScopeEntry[] = [];
        for (const [familyId, familySwimmers] of swimmersByFamily) {
          const family = await this.familiesRepository.findOne(familyId);
          if (family) {
            entries.push({ family, swimmers: familySwimmers });
          }
        }
        return entries;
      }

      case AppliesToType.SWIMMER: {
        if (!fee.applies_to_id) {
          throw new BadRequestException('Swimmer fee structure has no swimmer assigned');
        }
        const swimmer = await this.swimmersRepository.findOne(fee.applies_to_id);
        if (!swimmer) {
          throw new NotFoundException(`Swimmer with ID ${fee.applies_to_id} not found`);
        }
        if (!swimmer.family_id) {
          throw new BadRequestException('Swimmer has no family to invoice');
        }
        const family = await this.familiesRepository.findOne(swimmer.family_id);
        if (!family) {
          throw new NotFoundException(`Family with ID ${swimmer.family_id} not found`);
        }
        return [{ family, swimmers: [swimmer] }];
      }

      default:
        return [];
    }
  }

  /**
   * Derives the billing period key for a fee structure when the caller did not
   * supply one. Monthly fees use the current calendar month in the club's
   * timezone ('YYYY-MM'), annual fees the current year ('YYYY'). Term and
   * one-time fees have no calendar cadence, so they default to the current
   * year: combined with the fee_structure_id recorded on each invoice that is
   * enough for idempotent re-runs, and the UI passes an explicit label (for
   * example 'Term 1 2027') for term fees instead.
   */
  private deriveBillingPeriod(fee: FeeStructure, timezone: string): string {
    const [year, month] = this.clubToday(timezone).split('-');
    switch (fee.frequency) {
      case FeeFrequency.MONTHLY:
        return `${year}-${month}`;
      case FeeFrequency.ANNUAL:
      case FeeFrequency.TERM:
      case FeeFrequency.ONE_TIME:
      default:
        return year;
    }
  }

  /** Today's calendar date in the given timezone as 'YYYY-MM-DD'. */
  private clubToday(timezone: string): string {
    // The en-CA locale formats numeric dates as ISO-style YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /** Adds whole days to a 'YYYY-MM-DD' date string. */
  private addDays(isoDate: string, days: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  }

  async sendReminder(invoiceId: string): Promise<{ message: string }> {
    const invoice = await this.findOne(invoiceId);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot send a reminder for a paid invoice');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot send a reminder for a cancelled invoice');
    }

    // Resolve the owning club so amounts and dates in the reminder use the
    // club's currency and locale. Falls back to the region defaults (GB by
    // default) so every existing UK club produces identical output.
    const club = await this.clubsRepository.findOne(this.tenantContext.getClubId());
    const region = regionForCountry(club?.country);
    const currency = club?.currency ?? region.currency;
    const locale = club?.locale ?? region.locale;

    // Send reminder email to the family
    try {
      const family = await this.familiesRepository.findOne(invoice.family_id);
      if (family && family.primary_contact_email) {
        await this.emailService.sendInvoiceCreated({
          familyName: family.family_name,
          recipientEmail: family.primary_contact_email,
          invoiceNumber: invoice.invoice_number,
          // Date-only columns render in UTC so the stored calendar date never
          // shifts for clubs behind UTC (see the create path above).
          invoiceDate: formatClubDate(invoice.issued_date, locale, 'UTC'),
          dueDate: formatClubDate(invoice.due_date, locale, 'UTC'),
          totalAmount: formatMoney(invoice.total_amount, currency, locale),
          ...this.buildTaxEmailFields(invoice, club, currency, locale),
          items:
            invoice.items?.map((item) => ({
              description: item.description,
              amount: formatMoney(item.total, currency, locale),
            })) || [],
        });
        this.logger.log(
          `Payment reminder email sent to ${family.primary_contact_email} for invoice ${invoice.invoice_number}`,
        );
      } else {
        this.logger.warn(
          `Cannot send reminder for invoice ${invoice.invoice_number}: family not found or no email address`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send reminder email for invoice ${invoiceId}: ${err.message}`,
        err.stack,
      );
      // Still return success as the reminder was attempted and logged
    }

    // If the invoice is still in draft, mark it as sent
    if (invoice.status === InvoiceStatus.DRAFT) {
      await this.invoicesRepository.updateStatus(invoiceId, InvoiceStatus.PENDING);
    }

    return { message: 'Payment reminder sent successfully' };
  }

  async updateOverdueInvoices(): Promise<void> {
    const overdueInvoices = await this.invoicesRepository.findOverdue();
    for (const invoice of overdueInvoices) {
      await this.invoicesRepository.updateStatus(invoice.invoice_id, InvoiceStatus.OVERDUE);
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoicesRepository.count();
    const nextNumber = count + 1;
    return `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Builds the optional tax breakdown fields for an invoice email. Only returns
   * subtotal, taxLabel and taxAmount when tax was actually applied; a club with
   * no tax rate yields an empty object, so the email shows a single Total row
   * exactly as before. Shared by the create and reminder email paths so the
   * fallback label and the threshold stay in one place.
   *
   * When tax was applied AND the club has a tax registration number on file,
   * the email is a tax invoice: isTaxInvoice switches the template title and
   * the taxRegistrationLabel/taxRegistrationNumber pair renders the ABN (AU),
   * VAT number (GB) or GST/HST number (CA) line. taxInclusive marks invoices
   * whose prices already include the tax, so the template renders an
   * "Includes GST" row instead of an added-on-top breakdown. GB clubs without
   * a registration number get none of these fields, so their emails are
   * unchanged.
   */
  private buildTaxEmailFields(
    invoice: Invoice,
    club: Club | null,
    currency: string,
    locale: string,
  ): {
    subtotal?: string;
    taxLabel?: string;
    taxAmount?: string;
    taxInclusive?: boolean;
    isTaxInvoice?: boolean;
    taxRegistrationLabel?: string;
    taxRegistrationNumber?: string;
  } {
    if (Number(invoice.tax_amount) <= 0) {
      return {};
    }
    const registrationNumber = club?.tax_registration_number ?? null;
    return {
      subtotal: formatMoney(invoice.subtotal, currency, locale),
      taxLabel: club?.tax_label ?? 'Tax',
      taxAmount: formatMoney(invoice.tax_amount, currency, locale),
      taxInclusive: club?.tax_inclusive === true,
      ...(registrationNumber
        ? {
            isTaxInvoice: true,
            taxRegistrationLabel: taxRegistrationLabelForCountry(club?.country),
            taxRegistrationNumber: registrationNumber,
          }
        : {}),
    };
  }

  /**
   * Recomputes an invoice's subtotal, tax and total. The owning club supplies
   * the tax rate; callers that already hold it (e.g. create) pass it in to
   * avoid a second lookup, otherwise it is fetched by the invoice's club_id.
   */
  private async recalculateTotals(invoiceId: string, club?: Club | null): Promise<void> {
    const invoice = await this.invoicesRepository.findOne(invoiceId);
    if (!invoice || !invoice.items) {
      return;
    }

    const subtotal = invoice.items.reduce(
      (sum, item) => sum + parseFloat(item.total.toString()),
      0,
    );

    // Apply the owning club's tax rate. tax_rate is a decimal column so it
    // arrives from TypeORM as a string; Number() it before arithmetic. A null
    // or zero rate keeps tax_amount at 0, so every existing UK club (all of
    // which have a null rate) produces byte-identical totals as before.
    const owningClub = club ?? (await this.clubsRepository.findOne(invoice.club_id));
    const taxRate = owningClub?.tax_rate ? Number(owningClub.tax_rate) : 0;

    if (taxRate && owningClub?.tax_inclusive) {
      // Tax-inclusive pricing (the Australian GST convention): the line-item
      // sum IS the gross total the family pays. Back the tax out of it rather
      // than adding it on top, e.g. $55.00 gross at 10% GST is $5.00 tax on a
      // $50.00 subtotal, total $55.00.
      const gross = roundTo2dp(subtotal);
      const taxAmount = roundTo2dp((gross * taxRate) / (100 + taxRate));
      await this.invoicesRepository.updateTotals(
        invoiceId,
        roundTo2dp(gross - taxAmount),
        taxAmount,
        gross,
      );
      return;
    }

    // Tax-exclusive (default): tax is added on top of the line-item subtotal.
    const taxAmount = taxRate ? roundTo2dp((subtotal * taxRate) / 100) : 0;
    const totalAmount = roundTo2dp(subtotal + taxAmount);

    await this.invoicesRepository.updateTotals(invoiceId, subtotal, taxAmount, totalAmount);
  }
}
