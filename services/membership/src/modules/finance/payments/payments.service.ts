import { BillingBalanceService } from '../adjustments/billing-balance.service';
import { PaymentOperationsService } from '../adjustments/payment-operations.service';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { MandatesRepository } from '../mandates/mandates.repository';
import { PaymentProviderRegistry } from '../payment-providers/payment-provider.registry';
import { FamiliesRepository } from '../../families/families.repository';
import { EmailService } from '../../email/email.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { InvoiceStatus } from '../invoices/entities/invoice.entity';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { formatClubDate, formatMoney } from '../../../common/region/format.util';
import { regionForCountry } from '../../../common/region/region.util';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly invoicesRepository: InvoicesRepository,
    private readonly mandatesRepository: MandatesRepository,
    private readonly paymentProviders: PaymentProviderRegistry,
    private readonly familiesRepository: FamiliesRepository,
    private readonly emailService: EmailService,
    private readonly clubsRepository: ClubsRepository,
    private readonly balances: BillingBalanceService,
    private readonly operations: PaymentOperationsService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    // Verify invoice exists
    const invoice = await this.invoicesRepository.findOne(createPaymentDto.invoice_id);
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${createPaymentDto.invoice_id} not found`);
    }

    // Validate payment amount doesn't exceed invoice total
    const totalPaid = await this.paymentsRepository.getTotalPaymentsByInvoice(
      createPaymentDto.invoice_id,
    );
    const remainingAmount = parseFloat(invoice.total_amount.toString()) - totalPaid;

    if (createPaymentDto.amount > remainingAmount) {
      throw new BadRequestException(
        `Payment amount (${createPaymentDto.amount}) exceeds remaining invoice balance (${remainingAmount})`,
      );
    }

    // Create payment. The currency is taken from the parent invoice (the source
    // of truth), never from the caller, so a payment can never be recorded in a
    // currency that differs from its invoice. For a GBP invoice this is GBP, so
    // existing behaviour is unchanged.
    const payment = await this.balances.recordManual(invoice.club_id, {
      ...createPaymentDto,
      currency: invoice.currency ?? 'GBP',
    });

    // Update invoice status if payment is confirmed
    if (payment.status === PaymentStatus.CONFIRMED) {
      await this.updateInvoiceStatus(createPaymentDto.invoice_id);
      this.sendPaymentNotification(payment, 'confirmed');
    }

    return payment;
  }

  async findAll(): Promise<Payment[]> {
    return await this.paymentsRepository.findAll();
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    return await this.paymentsRepository.findByInvoice(invoiceId);
  }

  async findByStatus(status: PaymentStatus): Promise<Payment[]> {
    return await this.paymentsRepository.findByStatus(status);
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne(id);
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return payment;
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto): Promise<Payment> {
    const existingPayment = await this.findOne(id);

    const updated = await this.balances.mutateManual(
      existingPayment.club_id,
      existingPayment,
      updatePaymentDto,
    );
    if (!updated) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // Update invoice status if payment status changed to confirmed
    if (
      updatePaymentDto.status === PaymentStatus.CONFIRMED &&
      existingPayment.status !== PaymentStatus.CONFIRMED
    ) {
      await this.updateInvoiceStatus(updated.invoice_id);
      this.sendPaymentNotification(updated, 'confirmed');
    } else if (
      updatePaymentDto.status === PaymentStatus.FAILED &&
      existingPayment.status !== PaymentStatus.FAILED
    ) {
      this.sendPaymentNotification(updated, 'failed');
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const payment = await this.findOne(id);
    await this.balances.mutateManual(payment.club_id, payment, null);
  }

  private async updateInvoiceStatus(invoiceId: string): Promise<void> {
    const invoice = await this.invoicesRepository.findOne(invoiceId);
    if (!invoice) return;

    const { balance } = await this.balances.invoice(invoice.club_id, invoiceId);
    if (balance.due_minor === 0)
      await this.invoicesRepository.updateStatus(invoiceId, InvoiceStatus.PAID);
  }

  /**
   * Automatically collect payment via Direct Debit for an invoice
   * @param invoiceId The invoice ID to collect payment for
   * @returns The created payment record, or null if no active mandate exists
   */
  async collectInvoiceForCurrentClub(invoiceId: string): Promise<Payment | null> {
    const invoice = await this.invoicesRepository.findOne(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.collectDirectDebitPayment(invoiceId);
  }

  async collectDirectDebitPayment(invoiceId: string): Promise<Payment | null> {
    const invoice = await this.invoicesRepository.findOneUnscoped(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    const operation = await this.operations.collect(invoice.club_id, invoiceId);
    if (!operation?.payment_id) return null;
    const payments = await this.paymentsRepository.findByProviderId(
      operation.provider,
      operation.provider_id!,
    );
    return payments;
  }

  /**
   * Collect payments for all pending invoices with active mandates
   * This can be run as a scheduled job
   */
  async collectPendingInvoicePayments(currentClubOnly = false): Promise<{
    attempted: number;
    successful: number;
    failed: number;
    skipped: number;
  }> {
    const stats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      // NON-REQUEST PATH: invoked by the payment-collection cron job
      // (PaymentCollectionTask) which has no tenant (CLS) context. It must
      // process pending invoices for every club, so it uses the unscoped read
      // and must not call getClubId(). Each invoice is then collected via
      // collectDirectDebitPayment, which scopes all downstream work by that
      // invoice's own club_id.
      const pendingInvoices = currentClubOnly
        ? await this.invoicesRepository.findByStatus(InvoiceStatus.PENDING)
        : await this.invoicesRepository.findByStatusUnscoped(InvoiceStatus.PENDING);

      this.logger.log(`Found ${pendingInvoices.length} pending invoices to process`);

      for (const invoice of pendingInvoices) {
        stats.attempted++;

        try {
          const payment = await this.collectDirectDebitPayment(invoice.invoice_id);

          if (payment) {
            stats.successful++;
            this.logger.log(
              `Successfully initiated payment collection for invoice ${invoice.invoice_id}`,
            );
          } else {
            stats.skipped++;
            this.logger.log(
              `Skipped payment collection for invoice ${invoice.invoice_id} (no active mandate or already paid)`,
            );
          }
        } catch (error) {
          stats.failed++;
          const err = error as Error;
          this.logger.error(
            `Failed to collect payment for invoice ${invoice.invoice_id}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `Payment collection completed: ${stats.successful} successful, ${stats.failed} failed, ${stats.skipped} skipped out of ${stats.attempted} attempted`,
      );

      return stats;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error during bulk payment collection: ${err.message}`, err.stack);
      throw error;
    }
  }

  private sendPaymentNotification(payment: Payment, status: 'confirmed' | 'failed'): void {
    (async () => {
      try {
        const invoice = await this.invoicesRepository.findOne(payment.invoice_id);
        if (!invoice) return;
        const family = await this.familiesRepository.findOne(invoice.family_id);
        if (!family || !family.primary_contact_email) return;

        // Resolve the owning club (via the invoice's own club_id, never a
        // client-supplied value) so the amount, date and payment-method label
        // reflect the club's currency, locale and region. Falls back to the
        // GB region defaults so every existing UK club is unchanged.
        const club = await this.clubsRepository.findOne(invoice.club_id);
        const region = regionForCountry(club?.country);
        const locale = club?.locale ?? region.locale;
        const currency = payment.currency ?? invoice.currency ?? club?.currency ?? region.currency;

        const common = {
          familyName: family.family_name,
          recipientEmail: family.primary_contact_email,
          paymentAmount: formatMoney(payment.amount, currency, locale),
          // payment_date is a date-only column (stored as UTC midnight), so
          // render it in UTC: the stored calendar date must appear as-is and
          // never shift for clubs behind UTC.
          paymentDate: formatClubDate(payment.payment_date, locale, 'UTC'),
          invoiceNumber: invoice.invoice_number,
          referenceNumber: payment.reference_number ?? payment.provider_payment_id ?? undefined,
        };
        if (status === 'confirmed') {
          await this.emailService.sendPaymentConfirmed({
            ...common,
            paymentMethod: payment.payment_method ?? region.paymentMethodLabel,
          });
        } else {
          await this.emailService.sendPaymentFailed({
            familyName: common.familyName,
            recipientEmail: common.recipientEmail,
            paymentAmount: common.paymentAmount,
            invoiceNumber: common.invoiceNumber,
          });
        }
      } catch (error) {
        this.logger.error(`Failed to send payment notification: ${(error as Error).message}`);
      }
    })();
  }
}
