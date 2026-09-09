import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { MandatesRepository } from '../mandates/mandates.repository';
import { PaymentProviderRegistry } from '../payment-providers/payment-provider.registry';
import { FamiliesRepository } from '../../families/families.repository';
import { EmailService } from '../../email/email.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import { InvoiceStatus } from '../invoices/entities/invoice.entity';
import { DirectDebitMandateStatus } from '../mandates/entities/direct-debit-mandate.entity';
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
    const payment = await this.paymentsRepository.create({
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

    const updated = await this.paymentsRepository.update(id, updatePaymentDto);
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
    await this.findOne(id);
    await this.paymentsRepository.remove(id);
  }

  private async updateInvoiceStatus(invoiceId: string): Promise<void> {
    const invoice = await this.invoicesRepository.findOne(invoiceId);
    if (!invoice) return;

    const totalPaid = await this.paymentsRepository.getTotalPaymentsByInvoice(invoiceId);
    const invoiceTotal = parseFloat(invoice.total_amount.toString());

    if (totalPaid >= invoiceTotal) {
      await this.invoicesRepository.updateStatus(invoiceId, InvoiceStatus.PAID);
    }
  }

  /**
   * Automatically collect payment via Direct Debit for an invoice
   * @param invoiceId The invoice ID to collect payment for
   * @returns The created payment record, or null if no active mandate exists
   */
  async collectDirectDebitPayment(invoiceId: string): Promise<Payment | null> {
    try {
      // NON-REQUEST PATH: this method is invoked by the payment-collection cron
      // job (PaymentCollectionTask) and by InvoicesService.create on the request
      // path. To work in both, it uses the unscoped repository variants and
      // derives club_id from the loaded invoice rather than the CLS context, so
      // it never calls getClubId(). A guessed invoice id still cannot collect a
      // payment for the wrong club because every downstream predicate is scoped
      // by the invoice's own club_id.
      const invoice = await this.invoicesRepository.findOneUnscoped(invoiceId);
      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
      }

      const clubId = invoice.club_id;

      // Check if invoice is already paid
      if (invoice.status === InvoiceStatus.PAID) {
        this.logger.log(`Invoice ${invoiceId} is already paid, skipping payment collection`);
        return null;
      }

      // Find active mandate for this family (scoped to the invoice's club).
      const activeMandates = await this.mandatesRepository.findByFamilyForClub(
        invoice.family_id,
        clubId,
      );
      const activeMandate = activeMandates.find(
        (m) => m.status === DirectDebitMandateStatus.ACTIVE,
      );

      if (!activeMandate) {
        this.logger.log(
          `No active mandate found for family ${invoice.family_id}, skipping automatic payment`,
        );
        return null;
      }

      // Calculate amount to collect (total - already paid)
      const totalPaid = await this.paymentsRepository.getTotalPaymentsByInvoiceForClub(
        invoiceId,
        clubId,
      );
      const amountToCollect = parseFloat(invoice.total_amount.toString()) - totalPaid;

      if (amountToCollect <= 0) {
        this.logger.log(
          `Invoice ${invoiceId} has no remaining balance, skipping payment collection`,
        );
        return null;
      }

      // Collect in the invoice's currency. Fall back to the owning club's
      // currency, then GBP, so a legacy invoice without a stored currency still
      // behaves exactly as before (UK clubs are GBP throughout).
      let currency = invoice.currency;
      if (!currency) {
        const club = await this.clubsRepository.findOne(clubId);
        currency = club?.currency ?? 'GBP';
      }

      this.logger.log(
        `Collecting ${currency} ${amountToCollect} via Direct Debit for invoice ${invoiceId} using mandate ${activeMandate.provider_mandate_id}`,
      );

      // The provider charge happens BEFORE the payment row below is written, so
      // a crash in between takes the payer's money and leaves no record of it.
      // A retry would then recompute the identical amountToCollect (because
      // totalPaid never saw the lost payment) and charge them a second time.
      //
      // Keying on the invoice AND the amount closes exactly that window: the
      // retry produces the same key and the provider returns the original
      // payment instead of taking more money. A genuinely later collection of a
      // different remaining balance yields a different key and proceeds
      // normally. Amount is in minor units so float formatting cannot make two
      // identical charges look like different keys.
      const idempotencyKey = `invoice-${invoiceId}-${Math.round(amountToCollect * 100)}`;

      // Charge the recurring payment via the club's payment provider.
      const provider = await this.paymentProviders.forClub(clubId);
      const providerPayment = await provider.chargeRecurring({
        amount: amountToCollect,
        currency,
        providerMandateId: activeMandate.provider_mandate_id,
        // GoCardless charges the mandate directly and ignores this; Stripe has
        // no chargeable mandate and must name the customer the payment method
        // is attached to.
        providerCustomerId: activeMandate.provider_customer_id ?? undefined,
        idempotencyKey,
        description: `Payment for invoice ${invoice.invoice_number}`,
        metadata: {
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number,
          family_id: invoice.family_id,
        },
      });

      // Create payment record, stamping the club derived from the parent invoice
      // (this path may run without CLS context, e.g. from the cron job).
      const payment = await this.paymentsRepository.createForClub(
        {
          invoice_id: invoiceId,
          amount: amountToCollect,
          currency,
          payment_method: PaymentMethod.DIRECT_DEBIT,
          // Stamp which provider took the money so the webhook handler (which
          // looks payments up by provider AND provider id) can find this row.
          provider: provider.connection.provider,
          provider_payment_id: providerPayment.providerPaymentId,
          payment_date: new Date().toISOString(),
          status: PaymentStatus.PENDING_SUBMISSION,
        },
        clubId,
      );

      this.logger.log(
        `Created payment ${payment.payment_id} for invoice ${invoiceId} with GoCardless payment ${providerPayment.providerPaymentId}`,
      );

      return payment;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to collect Direct Debit payment for invoice ${invoiceId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Collect payments for all pending invoices with active mandates
   * This can be run as a scheduled job
   */
  async collectPendingInvoicePayments(): Promise<{
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
      const pendingInvoices = await this.invoicesRepository.findByStatusUnscoped(
        InvoiceStatus.PENDING,
      );

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
