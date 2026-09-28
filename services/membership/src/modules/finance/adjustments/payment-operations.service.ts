import { EmailService } from '../../email/email.service';
import { formatClubDate, formatMoney } from '../../../common/region/format.util';
import { regionForCountry } from '../../../common/region/region.util';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { BillingBalanceService } from './billing-balance.service';
import { canonicalHash, minor, money } from './billing-calculator';
import { PaymentProviderRegistry } from '../payment-providers/payment-provider.registry';
import {
  ProviderSubmissionRejectedError,
  ChargeRecurringParams,
  PaymentProvider,
  ProviderOperationResult,
  RefundParams,
} from '../payment-providers/payment-provider.interface';

export interface Operation {
  operation_id: string;
  club_id: string;
  invoice_id: string;
  payment_id: string | null;
  kind: 'collection' | 'refund';
  amount_minor: string;
  currency: string;
  provider: string;
  external_account_id: string;
  provider_id: string | null;
  state: string;
  revision: number;
  request: ChargeRecurringParams & Partial<RefundParams>;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PaymentOperationsService {
  private readonly logger = new Logger(PaymentOperationsService.name);
  constructor(
    private readonly db: DataSource,
    private readonly balances: BillingBalanceService,
    private readonly providers: PaymentProviderRegistry,
    @Optional() private readonly email?: EmailService,
  ) {}

  private async provider(clubId: string, providerName?: string, account?: string | null) {
    const provider = await this.providers.forClub(clubId);
    if (
      providerName &&
      (provider.connection.provider !== providerName ||
        !account ||
        provider.connection.externalAccountId !== account)
    )
      throw new ConflictException(
        'The original payment account must be connected before this operation can continue',
      );
    if (
      !provider.inspectPayment ||
      !provider.inspectRefund ||
      !provider.refund ||
      !provider.findOperation
    )
      throw new BadRequestException('This provider does not support billing adjustments');
    return provider;
  }

  async refundPreview(
    clubId: string,
    invoiceId: string,
    paymentId: string,
    amount: number,
    reason: string,
  ) {
    const { invoice, balance } = await this.balances.invoice(clubId, invoiceId);
    const [payment] = await this.db.query(
      "SELECT * FROM payments WHERE club_id=$1 AND invoice_id=$2 AND payment_id=$3 AND status='confirmed'",
      [clubId, invoiceId, paymentId],
    );
    if (
      !payment ||
      !payment.provider_payment_id ||
      !payment.provider_account_id ||
      !['direct_debit', 'card'].includes(payment.payment_method)
    )
      throw new BadRequestException(
        'A confirmed provider payment with a verified original account is required',
      );
    if (payment.currency !== invoice.currency)
      throw new BadRequestException('Payment currency does not match');
    const provider = await this.provider(clubId, payment.provider, payment.provider_account_id);
    const remote = await provider.inspectPayment!(payment.provider_payment_id);
    const [reserved] = await this.db.query(
      "SELECT COALESCE(SUM(amount_minor),0) AS amount FROM billing_payment_operations WHERE club_id=$1 AND payment_id=$2 AND kind='refund' AND state <> 'failed'",
      [clubId, paymentId],
    );
    if (
      remote.id !== payment.provider_payment_id ||
      remote.currency !== invoice.currency ||
      remote.amountMinor !== minor(payment.amount) ||
      remote.state !== 'confirmed'
    )
      throw new ConflictException('Provider payment does not match the confirmed local payment');
    if (remote.refundedMinor !== Number(reserved.amount))
      throw new ConflictException(
        'Provider refund totals need reconciliation before another refund',
      );
    if (
      amount <= 0 ||
      amount > balance.available_credit_minor ||
      amount > minor(payment.amount) - Number(reserved.amount)
    )
      throw new ConflictException('Refund exceeds available credit or remaining payment');
    const snapshot = {
      invoice_id: invoiceId,
      payment_id: paymentId,
      amount_minor: amount,
      currency: invoice.currency,
      reason,
      provider: payment.provider,
      account: payment.provider_account_id,
      provider_payment_id: payment.provider_payment_id,
      total_refunded_minor: Number(reserved.amount) + amount,
      balance,
    };
    return { ...snapshot, preview_hash: canonicalHash(snapshot) };
  }

  async refund(
    clubId: string,
    actor: string,
    invoiceId: string,
    paymentId: string,
    amount: number,
    reason: string,
    operationId: string,
    hash: string,
  ) {
    // Reusing the operation ID after a lost HTTP response returns the existing intent.
    const [prior] = await this.db.query(
      'SELECT * FROM billing_payment_operations WHERE club_id=$1 AND operation_id=$2',
      [clubId, operationId],
    );
    const requestHash = canonicalHash({ invoiceId, paymentId, amount, reason });
    if (prior) {
      if (prior.kind !== 'refund' || prior.request_hash !== requestHash)
        throw new ConflictException('Operation reference already used');
      return this.reconcile(clubId, operationId);
    }
    const preview = await this.refundPreview(clubId, invoiceId, paymentId, amount, reason);
    if (preview.preview_hash !== hash)
      throw new ConflictException('Refund preview changed. Preview again.');
    await this.db.transaction(async (manager) => {
      await this.balances.lock(manager, clubId, [invoiceId]);
      const [duplicate] = await manager.query(
        'SELECT * FROM billing_payment_operations WHERE club_id=$1 AND operation_id=$2',
        [clubId, operationId],
      );
      if (duplicate) {
        if (duplicate.request_hash !== requestHash || duplicate.kind !== 'refund')
          throw new ConflictException('Operation reference already used');
        return;
      }
      const { balance } = await this.balances.invoice(clubId, invoiceId, manager);
      if (canonicalHash(balance) !== canonicalHash(preview.balance))
        throw new ConflictException('Invoice changed. Preview again.');
      const request = {
        reason,
        preview,
        providerPaymentId: preview.provider_payment_id,
        amountMinor: amount,
        totalRefundedMinor: preview.total_refunded_minor,
        operationId,
      };
      await manager.query(
        `INSERT INTO billing_payment_operations(operation_id,club_id,invoice_id,payment_id,kind,amount_minor,currency,provider,external_account_id,state,request,request_hash,actor_id) VALUES($1,$2,$3,$4,'refund',$5,$6,$7,$8,'requested',$9,$10,$11)`,
        [
          operationId,
          clubId,
          invoiceId,
          paymentId,
          amount,
          preview.currency,
          preview.provider,
          preview.account,
          request,
          requestHash,
          actor,
        ],
      );
    });
    return this.execute(clubId, operationId);
  }

  async collect(clubId: string, invoiceId: string, actor: string | null = null) {
    const provider = await this.provider(clubId);
    const operationId = await this.db.transaction(async (manager) => {
      await this.balances.lock(manager, clubId, [invoiceId]);
      const { invoice, balance } = await this.balances.invoice(clubId, invoiceId, manager);
      if (['draft', 'cancelled'].includes(invoice.status)) return null;
      const [pending] = await manager.query(
        "SELECT operation_id FROM billing_payment_operations WHERE club_id=$1 AND invoice_id=$2 AND kind='collection' AND state IN ('requested','pending','uncertain') ORDER BY created_at LIMIT 1",
        [clubId, invoiceId],
      );
      if (pending) return pending.operation_id;
      if (!balance.collectable_minor) return null;
      const [mandate] = await manager.query(
        "SELECT * FROM direct_debit_mandates WHERE club_id=$1 AND family_id=$2 AND status='active' AND provider=$3 ORDER BY created_at DESC LIMIT 1 FOR SHARE",
        [clubId, invoice.family_id, provider.connection.provider],
      );
      if (!mandate) return null;
      const id = randomUUID();
      const request: ChargeRecurringParams = {
        amount: Number(money(balance.collectable_minor)),
        currency: invoice.currency,
        providerMandateId: mandate.provider_mandate_id,
        providerCustomerId: mandate.provider_customer_id ?? undefined,
        idempotencyKey: id,
        description: `Invoice ${invoice.invoice_number}`,
        metadata: { billing_operation_id: id },
      };
      await manager.query(
        `INSERT INTO billing_payment_operations(operation_id,club_id,invoice_id,kind,amount_minor,currency,provider,external_account_id,state,request,request_hash,actor_id) VALUES($1,$2,$3,'collection',$4,$5,$6,$7,'requested',$8,$9,$10)`,
        [
          id,
          clubId,
          invoiceId,
          balance.collectable_minor,
          invoice.currency,
          provider.connection.provider,
          provider.connection.externalAccountId,
          request,
          canonicalHash(request),
          actor,
        ],
      );
      return id;
    });
    if (!operationId) return null;
    return this.execute(clubId, operationId);
  }

  private async get(clubId: string, id: string): Promise<Operation> {
    const [op] = await this.db.query(
      'SELECT * FROM billing_payment_operations WHERE club_id=$1 AND operation_id=$2',
      [clubId, id],
    );
    if (!op) throw new NotFoundException('Payment operation not found');
    return op;
  }

  async execute(clubId: string, id: string): Promise<Operation> {
    const op = await this.get(clubId, id);
    if (op.state !== 'requested') return this.reconcile(clubId, id);
    const provider = await this.provider(clubId, op.provider, op.external_account_id);
    // Claim and persist uncertainty BEFORE sending. Only one worker can send this intent.
    const [claimedRows] = await this.db.query(
      "UPDATE billing_payment_operations SET state='uncertain',revision=revision+1,updated_at=NOW() WHERE club_id=$1 AND operation_id=$2 AND state='requested' RETURNING *",
      [clubId, id],
    );
    const claimed: Operation | undefined = claimedRows[0];
    if (!claimed) return this.get(clubId, id);
    try {
      const result =
        op.kind === 'refund'
          ? await provider.refund!(op.request as RefundParams)
          : await this.charge(provider, op.request);
      await this.record(claimed, result);
    } catch (error) {
      const rejected = error instanceof ProviderSubmissionRejectedError;
      await this.db.query(
        'UPDATE billing_payment_operations SET state=$4,error=$5,needs_reconciliation=$6,revision=revision+1,updated_at=NOW() WHERE club_id=$1 AND operation_id=$2 AND revision=$3',
        [
          clubId,
          id,
          claimed.revision,
          rejected ? 'failed' : 'uncertain',
          rejected
            ? error.message
            : 'Provider outcome is uncertain. Reconcile before trying another operation.',
          !rejected,
        ],
      );
    }
    return this.get(clubId, id);
  }

  private async charge(provider: PaymentProvider, request: ChargeRecurringParams) {
    const result = await provider.chargeRecurring(request);
    // If inspecting fails, metadata lookup recovers the payment on the next reconciliation.
    return provider.inspectPayment!(result.providerPaymentId);
  }

  async reconcile(clubId: string, id: string): Promise<Operation> {
    const op = await this.get(clubId, id);
    if (op.state === 'requested') return this.execute(clubId, id);
    const provider = await this.provider(clubId, op.provider, op.external_account_id);
    const result = op.provider_id
      ? await (op.kind === 'refund'
          ? provider.inspectRefund!(op.provider_id)
          : provider.inspectPayment!(op.provider_id))
      : await provider.findOperation!({
          kind: op.kind,
          operationId: id,
          providerPaymentId: op.request.providerPaymentId,
          providerMandateId: op.request.providerMandateId,
          providerCustomerId: op.request.providerCustomerId,
          createdAt: new Date(op.created_at.getTime() - 60000).toISOString(),
        });
    // Absence in a list is not proof that a timed-out request failed. Never re-send here.
    if (result) await this.record(op, result);
    else
      await this.db.query(
        'UPDATE billing_payment_operations SET updated_at=NOW() WHERE club_id=$1 AND operation_id=$2 AND revision=$3',
        [clubId, id, op.revision],
      );
    return this.get(clubId, id);
  }

  private async record(op: Operation, result: ProviderOperationResult) {
    if (
      !result.id ||
      result.operationId !== op.operation_id ||
      result.amountMinor !== Number(op.amount_minor) ||
      result.currency !== op.currency ||
      (op.kind === 'refund' && result.paymentId !== op.request.providerPaymentId)
    )
      throw new ConflictException('Provider operation does not match the saved intent');
    const notify = await this.db.transaction(async (manager) => {
      await this.balances.lock(manager, op.club_id, [op.invoice_id]);
      const [current] = await manager.query(
        'SELECT * FROM billing_payment_operations WHERE club_id=$1 AND operation_id=$2 FOR UPDATE',
        [op.club_id, op.operation_id],
      );
      if (current.revision !== op.revision) {
        await manager.query(
          'UPDATE billing_payment_operations SET needs_reconciliation=true WHERE club_id=$1 AND operation_id=$2',
          [op.club_id, op.operation_id],
        );
        return;
      }
      let paymentId = current.payment_id;
      if (op.kind === 'collection') {
        const status =
          result.state === 'confirmed'
            ? 'confirmed'
            : result.state === 'failed'
              ? 'failed'
              : 'submitted';
        if (!paymentId) {
          paymentId = randomUUID();
          await manager.query(
            `INSERT INTO payments(payment_id,club_id,invoice_id,amount,currency,payment_date,payment_method,status,provider,provider_payment_id,provider_account_id) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,'direct_debit',$6,$7,$8,$9)`,
            [
              paymentId,
              op.club_id,
              op.invoice_id,
              money(Number(op.amount_minor)),
              op.currency,
              status,
              op.provider,
              result.id,
              op.external_account_id,
            ],
          );
        } else {
          await manager.query(
            'UPDATE payments SET status=$3,updated_at=NOW() WHERE club_id=$1 AND payment_id=$2',
            [op.club_id, paymentId, status],
          );
        }
      }
      await manager.query(
        'UPDATE billing_payment_operations SET payment_id=$3,provider_id=$4,state=$5,error=NULL,needs_reconciliation=false,revision=revision+1,updated_at=NOW() WHERE club_id=$1 AND operation_id=$2',
        [op.club_id, op.operation_id, paymentId, result.id, result.state],
      );
      await this.balances.syncStatus(manager, op.club_id, op.invoice_id);
      return (
        op.kind === 'collection' && result.state !== 'pending' && current.state !== result.state
      );
    });
    if (notify && this.email) {
      try {
        const [details] = await this.db.query(
          `SELECT i.invoice_number,f.family_name,f.primary_contact_email,c.country,c.locale,p.payment_date FROM invoices i JOIN families f ON f.family_id=i.family_id AND f.club_id=i.club_id JOIN clubs c ON c.id=i.club_id JOIN payments p ON p.invoice_id=i.invoice_id AND p.club_id=i.club_id WHERE i.club_id=$1 AND i.invoice_id=$2 AND p.provider_payment_id=$3`,
          [op.club_id, op.invoice_id, result.id],
        );
        if (details?.primary_contact_email) {
          const region = regionForCountry(details.country);
          const locale = details.locale ?? region.locale;
          const common = {
            familyName: details.family_name,
            recipientEmail: details.primary_contact_email,
            paymentAmount: formatMoney(Number(money(Number(op.amount_minor))), op.currency, locale),
            invoiceNumber: details.invoice_number,
          };
          if (result.state === 'confirmed')
            await this.email.sendPaymentConfirmed({
              ...common,
              paymentDate: formatClubDate(details.payment_date, locale, 'UTC'),
              paymentMethod: region.paymentMethodLabel,
              referenceNumber: result.id,
            });
          else await this.email.sendPaymentFailed(common);
        }
      } catch {
        this.logger.warn(`Payment notification failed for operation ${op.operation_id}`);
      }
    }
  }

  @Cron('*/5 * * * *')
  async reconcilePending() {
    const operations: Operation[] = await this.db.query(
      "SELECT * FROM billing_payment_operations WHERE needs_reconciliation=true OR state IN ('requested','pending','uncertain') ORDER BY updated_at LIMIT 100",
    );
    for (const op of operations) {
      try {
        await this.reconcile(op.club_id, op.operation_id);
      } catch {
        this.logger.warn(`Reconciliation pending for billing operation ${op.operation_id}`);
        await this.db.query(
          'UPDATE billing_payment_operations SET updated_at=NOW() WHERE club_id=$1 AND operation_id=$2',
          [op.club_id, op.operation_id],
        );
      }
    }
  }
}
