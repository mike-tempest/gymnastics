import { Injectable, Logger } from '@nestjs/common';
import { MandatesRepository } from '../finance/mandates/mandates.repository';
import { PaymentsRepository } from '../finance/payments/payments.repository';
import { InvoicesRepository } from '../finance/invoices/invoices.repository';
import { FamiliesRepository } from '../families/families.repository';
import { DirectDebitMandateStatus } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { PaymentStatus } from '../finance/payments/entities/payment.entity';
import { EmailService } from '../email/email.service';
import { ClubsRepository } from '../clubs/clubs.repository';
import { formatMoney, formatClubDate } from '../../common/region/format.util';
import { regionForCountry } from '../../common/region/region.util';
import { resolveFailureReason } from './payment-failure-messages';

/**
 * Region-formatting defaults used when a club cannot be resolved. Derived from
 * the GB region config so a webhook whose club lookup fails still produces the
 * original UK-formatted email rather than crashing.
 */
const FALLBACK_REGION = regionForCountry('GB');
const FALLBACK_CURRENCY = FALLBACK_REGION.currency;
const FALLBACK_LOCALE = FALLBACK_REGION.locale;
const FALLBACK_TIMEZONE = FALLBACK_REGION.defaultTimezone;

export interface GoCardlessWebhookEvent {
  id: string;
  resource_type: string;
  action: string;
  links: Record<string, string>;
  /**
   * GoCardless event details. For failure events, `cause` is the normalised
   * machine-readable value (e.g. insufficient_funds, refer_to_payer), the same
   * across Bacs and BECS; `reason_code` is the raw scheme code (Bacs ARUDD /
   * BECS return code); `description` is GoCardless's human sentence.
   */
  details?: {
    origin?: string;
    cause?: string;
    description?: string;
    reason_code?: string;
    scheme?: string;
  };
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly mandatesRepository: MandatesRepository,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly invoicesRepository: InvoicesRepository,
    private readonly familiesRepository: FamiliesRepository,
    private readonly emailService: EmailService,
    private readonly clubsRepository: ClubsRepository,
  ) {}

  /**
   * Resolves the region-formatting settings (currency, locale, timezone) for a
   * club. Webhooks run outside tenant context, so the club id comes from the
   * loaded mandate or payment record. A failed or missing lookup falls back to
   * the GB defaults so a formatting problem never turns a webhook into a 500.
   */
  private async resolveClubRegion(clubId: string): Promise<{
    currency: string | null;
    locale: string;
    timezone: string;
    country?: string;
  }> {
    try {
      const club = await this.clubsRepository.findOne(clubId);
      if (club) {
        return {
          currency: club.currency ?? null,
          locale: club.locale ?? FALLBACK_LOCALE,
          timezone: club.timezone ?? FALLBACK_TIMEZONE,
          country: club.country,
        };
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to resolve club ${clubId} for webhook email formatting: ${err.message}`,
        err.stack,
      );
    }
    return {
      currency: null,
      locale: FALLBACK_LOCALE,
      timezone: FALLBACK_TIMEZONE,
    };
  }

  /**
   * Process one verified webhook event.
   *
   * `routedClubId` is the club the provider says the event belongs to, resolved
   * from the connected account that sent it. It is null for events from
   * Swimly's own legacy account, which serves every club at once and therefore
   * cannot identify one; those fall back to deriving the club from the loaded
   * record, exactly as before. That ambiguity is the merchant-of-record problem
   * itself, and it disappears with the last legacy club.
   *
   * `provider` selects which provider's records to resolve the event against.
   * Events are normalised to a common shape before they reach here, so this
   * handler is provider-agnostic despite living in the gocardless module; the
   * provider only decides which (provider, provider_*_id) rows to look up.
   * Defaults to gocardless so the GoCardless controller need not pass it.
   */
  async handleEvent(
    event: GoCardlessWebhookEvent,
    routedClubId: string | null = null,
    provider = 'gocardless',
  ) {
    this.logger.log(
      `Processing ${provider} event: ${event.id}, type: ${event.resource_type}, ` +
        `action: ${event.action}`,
    );

    switch (event.resource_type) {
      case 'mandates':
        await this.handleMandateEvent(event, routedClubId, provider);
        break;
      case 'payments':
        await this.handlePaymentEvent(event, routedClubId, provider);
        break;
      case 'subscriptions':
        this.logger.log('Subscription event received but not implemented');
        break;
      default:
        this.logger.warn(`Unknown event type: ${event.resource_type}`);
    }
  }

  /**
   * Cross-check the club the provider routed the event to against the club that
   * actually owns the record it refers to.
   *
   * Under connected accounts these must agree: a club's provider account can
   * only emit events about that club's own mandates and payments. A mismatch
   * means either a provider account is mapped to the wrong club or a record id
   * has been guessed, and acting on it would mutate one club's billing from
   * another club's webhook. Neither is recoverable here, so drop the event
   * loudly rather than guess which side is right.
   *
   * A null routedClubId means the event came from Swimly's own legacy account,
   * which serves every club and so names none; there is nothing to cross-check
   * against and the record's own club stands, exactly as before.
   */
  private belongsToRoutedClub(
    event: GoCardlessWebhookEvent,
    recordClubId: string,
    routedClubId: string | null,
  ): boolean {
    if (routedClubId === null) {
      return true;
    }

    if (recordClubId !== routedClubId) {
      this.logger.error(
        `TENANT MISMATCH on webhook event ${event.id}: the connected account resolved to club ` +
          `${routedClubId} but the referenced record belongs to club ${recordClubId}. ` +
          `Dropping the event. This should be impossible; investigate the connection mapping.`,
      );
      return false;
    }

    return true;
  }

  private async handleMandateEvent(
    event: GoCardlessWebhookEvent,
    routedClubId: string | null,
    provider: string,
  ) {
    const mandateId = event.links.mandate;
    const action = event.action;

    this.logger.log(`Handling mandate event: ${mandateId}, action: ${action}`);

    const mandate = await this.mandatesRepository.findByProviderId(provider, mandateId);
    if (!mandate) {
      this.logger.warn(`Mandate not found in database: ${mandateId}`);
      return;
    }

    if (!this.belongsToRoutedClub(event, mandate.club_id, routedClubId)) {
      return;
    }

    // Map action to status
    let newStatus: DirectDebitMandateStatus | null = null;

    switch (action) {
      case 'created':
      case 'submitted':
      case 'reinstated':
        newStatus = DirectDebitMandateStatus.PENDING;
        break;
      case 'active':
        newStatus = DirectDebitMandateStatus.ACTIVE;
        break;
      case 'cancelled':
      case 'expired':
        newStatus = DirectDebitMandateStatus.CANCELLED;
        break;
      case 'failed':
        newStatus = DirectDebitMandateStatus.FAILED;
        break;
    }

    if (newStatus && newStatus !== mandate.status) {
      // Webhook path: no tenant/CLS context. Scope by the loaded mandate's club.
      await this.mandatesRepository.updateStatusForClub(
        mandate.mandate_id,
        mandate.club_id,
        newStatus,
      );
      this.logger.log(`Updated mandate ${mandate.mandate_id} status to ${newStatus}`);

      // Send email when mandate becomes active
      if (newStatus === DirectDebitMandateStatus.ACTIVE) {
        try {
          const family = await this.familiesRepository.findOneUnscoped(mandate.family_id);
          if (family && family.primary_contact_email) {
            const region = await this.resolveClubRegion(mandate.club_id);
            await this.emailService.sendMandateConfirmed({
              familyName: family.family_name,
              recipientEmail: family.primary_contact_email,
              mandateReference: mandate.provider_mandate_id,
              setupDate: formatClubDate(new Date(), region.locale, region.timezone),
              directDebitScheme: regionForCountry(region.country).directDebitScheme,
            });
            this.logger.log(`Mandate confirmed email sent to ${family.primary_contact_email}`);
          }
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to send mandate confirmed email for mandate ${mandate.mandate_id}: ${err.message}`,
            err.stack,
          );
        }
      }
    }
  }

  private async handlePaymentEvent(
    event: GoCardlessWebhookEvent,
    routedClubId: string | null,
    provider: string,
  ) {
    const providerPaymentId = event.links.payment;
    const action = event.action;

    this.logger.log(`Handling payment event: ${providerPaymentId}, action: ${action}`);

    const payment = await this.paymentsRepository.findByProviderId(provider, providerPaymentId);
    if (!payment) {
      this.logger.warn(`Payment not found in database: ${providerPaymentId}`);
      return;
    }

    if (!this.belongsToRoutedClub(event, payment.club_id, routedClubId)) {
      return;
    }

    // Map action to status
    let newStatus: PaymentStatus | null = null;

    switch (action) {
      case 'created':
      case 'submitted':
        newStatus = PaymentStatus.SUBMITTED;
        break;
      case 'confirmed':
      case 'paid_out':
        newStatus = PaymentStatus.CONFIRMED;
        break;
      case 'failed':
      case 'charged_back':
      case 'cancelled':
        newStatus = PaymentStatus.FAILED;
        break;
    }

    if (newStatus && newStatus !== payment.status) {
      // A failed (or charged-back / cancelled) payment records why it failed.
      // GoCardless normalises the cause across schemes, so a Bacs ARUDD return
      // and its BECS equivalent persist the same machine-readable value.
      const failureDetails =
        newStatus === PaymentStatus.FAILED && (event.details?.cause || event.details?.description)
          ? {
              cause: event.details?.cause ?? null,
              description: event.details?.description
                ? event.details.description.slice(0, 255)
                : null,
            }
          : undefined;

      // Webhook path: no tenant/CLS context. Scope by the loaded payment's club.
      if (failureDetails) {
        await this.paymentsRepository.updatePaymentStatusForClub(
          payment.payment_id,
          payment.club_id,
          newStatus,
          failureDetails,
        );
      } else {
        await this.paymentsRepository.updatePaymentStatusForClub(
          payment.payment_id,
          payment.club_id,
          newStatus,
        );
      }
      this.logger.log(`Updated payment ${payment.payment_id} status to ${newStatus}`);

      // Get invoice and family details for email
      const invoice = await this.invoicesRepository.findOneUnscoped(payment.invoice_id);
      if (!invoice) {
        this.logger.warn(`Invoice not found for payment ${payment.payment_id}`);
        return;
      }

      const family = await this.familiesRepository.findOneUnscoped(invoice.family_id);
      if (!family || !family.primary_contact_email) {
        this.logger.warn(`Family not found or no email for payment ${payment.payment_id}`);
        return;
      }

      // Resolve the club once so both email branches format money and dates in
      // the club's currency, locale and timezone.
      const region = await this.resolveClubRegion(payment.club_id);
      const paymentAmount = formatMoney(
        payment.amount,
        region.currency ?? payment.currency ?? FALLBACK_CURRENCY,
        region.locale,
      );

      // Send appropriate email based on payment status
      if (newStatus === PaymentStatus.CONFIRMED) {
        this.logger.log(
          `Payment ${payment.payment_id} confirmed for invoice ${payment.invoice_id}`,
        );

        try {
          await this.emailService.sendPaymentConfirmed({
            familyName: family.family_name,
            recipientEmail: family.primary_contact_email,
            paymentAmount,
            paymentDate: this.formatPaymentDate(
              payment.payment_date,
              region.locale,
              region.timezone,
            ),
            paymentMethod: this.formatPaymentMethod(payment.payment_method, region.country),
            invoiceNumber: invoice.invoice_number,
            referenceNumber: payment.reference_number || undefined,
          });
          this.logger.log(`Payment confirmed email sent to ${family.primary_contact_email}`);
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to send payment confirmed email for payment ${payment.payment_id}: ${err.message}`,
            err.stack,
          );
        }
      } else if (newStatus === PaymentStatus.FAILED) {
        this.logger.log(`Payment ${payment.payment_id} failed for invoice ${payment.invoice_id}`);

        try {
          // Mapped copy for the normalised cause, then GoCardless's own
          // description, then the pre-existing generic string, so an event
          // without details produces a byte-identical email to before.
          const { reason, isSpecific } = resolveFailureReason(event.details);
          await this.emailService.sendPaymentFailed({
            familyName: family.family_name,
            recipientEmail: family.primary_contact_email,
            paymentAmount,
            invoiceNumber: invoice.invoice_number,
            failureReason: reason,
            hasSpecificFailureReason: isSpecific,
            retryDate: this.calculateRetryDate(region.locale, region.timezone),
          });
          this.logger.log(`Payment failed email sent to ${family.primary_contact_email}`);
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to send payment failed email for payment ${payment.payment_id}: ${err.message}`,
            err.stack,
          );
        }
      }
    }
  }

  /**
   * Formats a payment date for email copy. The payment_date column is a
   * date-only column, which TypeORM returns as a 'YYYY-MM-DD' string at
   * runtime. Parsing that with new Date() lands on midnight UTC, so formatting
   * it in a negative-offset timezone (US/CA) would show the previous calendar
   * day. Date-only values are therefore formatted in UTC to preserve the
   * stored calendar day; genuine timestamps use the club timezone.
   */
  private formatPaymentDate(
    paymentDate: Date | string | null | undefined,
    locale: string,
    timezone: string,
  ): string {
    const value = paymentDate || new Date();
    const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    return formatClubDate(value, locale, timezone, isDateOnly ? { timeZone: 'UTC' } : undefined);
  }

  private formatPaymentMethod(method: string, country?: string): string {
    const methodMap: Record<string, string> = {
      direct_debit: regionForCountry(country).paymentMethodLabel,
      card: 'Card Payment',
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      other: 'Other',
    };
    return methodMap[method] || method;
  }

  private calculateRetryDate(locale: string, timezone: string): string {
    const retryDate = new Date();
    retryDate.setDate(retryDate.getDate() + 3); // Retry in 3 days
    return formatClubDate(retryDate, locale, timezone);
  }
}
