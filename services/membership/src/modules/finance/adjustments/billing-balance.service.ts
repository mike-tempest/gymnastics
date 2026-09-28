import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { UpdatePaymentDto } from '../payments/dto/update-payment.dto';
import { minor } from './billing-calculator';

export interface BalanceInputs {
  total: number;
  credits: number;
  incoming: number;
  outgoing: number;
  paid: number;
  pending: number;
  collections: number;
  refunds: number;
  confirmedRefunds: number;
}

/** All amounts are integer minor units. Reservations are not settled cash. */
export function calculateBalance(i: BalanceInputs) {
  for (const amount of Object.values(i)) {
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new Error('Invalid billing ledger amount');
  }
  const adjusted = i.total - i.credits - i.incoming;
  const due = Math.max(0, adjusted - i.paid + i.confirmedRefunds);
  return {
    original_minor: i.total,
    credit_notes_minor: i.credits,
    allocated_in_minor: i.incoming,
    allocated_out_minor: i.outgoing,
    paid_minor: i.paid,
    refunded_minor: i.confirmedRefunds,
    reserved_refunds_minor: i.refunds - i.confirmedRefunds,
    pending_minor: i.pending + i.collections,
    due_minor: due,
    collectable_minor: Math.max(0, due - i.pending - i.collections),
    available_credit_minor: Math.max(0, i.paid - adjusted - i.outgoing - i.refunds),
  };
}

export type BillingBalance = ReturnType<typeof calculateBalance>;

@Injectable()
export class BillingBalanceService {
  constructor(private readonly db: DataSource) {}

  async invoice(clubId: string, invoiceId: string, manager: EntityManager = this.db.manager) {
    const [invoice] = await manager.query(
      'SELECT * FROM invoices WHERE club_id=$1 AND invoice_id=$2',
      [clubId, invoiceId],
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    const [sums] = await manager.query(
      `SELECT
      COALESCE((SELECT SUM(CASE WHEN kind='credit' THEN amount_minor ELSE -amount_minor END) FROM billing_credit_notes WHERE club_id=$1 AND invoice_id=$2),0) AS credits,
      COALESCE((SELECT SUM(amount_minor) FROM billing_credit_allocations WHERE club_id=$1 AND target_invoice_id=$2),0) AS incoming,
      COALESCE((SELECT SUM(amount_minor) FROM billing_credit_allocations WHERE club_id=$1 AND source_invoice_id=$2),0) AS outgoing,
      COALESCE((SELECT SUM(amount*100) FROM payments WHERE club_id=$1 AND invoice_id=$2 AND status='confirmed'),0) AS paid,
      COALESCE((SELECT SUM(amount*100) FROM payments WHERE club_id=$1 AND invoice_id=$2 AND status IN ('pending_submission','submitted')),0) AS pending,
      COALESCE((SELECT SUM(amount_minor) FROM billing_payment_operations WHERE club_id=$1 AND invoice_id=$2 AND kind='collection' AND payment_id IS NULL AND state <> 'failed'),0) AS collections,
      COALESCE((SELECT SUM(amount_minor) FROM billing_payment_operations WHERE club_id=$1 AND invoice_id=$2 AND kind='refund' AND state <> 'failed'),0) AS refunds,
      COALESCE((SELECT SUM(amount_minor) FROM billing_payment_operations WHERE club_id=$1 AND invoice_id=$2 AND kind='refund' AND state='confirmed'),0) AS "confirmedRefunds"`,
      [clubId, invoiceId],
    );
    const inputs = Object.fromEntries(
      Object.entries(sums).map(([key, value]) => [key, Number(value)]),
    );
    return {
      invoice,
      balance: calculateBalance({ total: minor(invoice.total_amount), ...inputs } as BalanceInputs),
    };
  }

  async recordManual(clubId: string, dto: CreatePaymentDto) {
    return this.db.transaction(async (manager) => {
      await this.lock(manager, clubId, [dto.invoice_id]);
      const { invoice, balance } = await this.invoice(clubId, dto.invoice_id, manager);
      if (
        ['draft', 'cancelled'].includes(invoice.status) ||
        minor(dto.amount) <= 0 ||
        minor(dto.amount) > balance.collectable_minor
      )
        throw new BadRequestException('Payment exceeds the available invoice balance');
      if (dto.provider_payment_id)
        throw new BadRequestException('Provider payments must be recorded through reconciliation');
      const repository = manager.getRepository(Payment);
      const payment = await repository.save(
        repository.create({
          ...dto,
          club_id: clubId,
          currency: invoice.currency,
          payment_date: dto.payment_date ? new Date(dto.payment_date) : new Date(),
        }),
      );
      await this.syncStatus(manager, clubId, dto.invoice_id);
      return payment;
    });
  }

  async mutateManual(clubId: string, payment: Payment, dto: UpdatePaymentDto | null) {
    return this.db.transaction(async (manager) => {
      await this.lock(manager, clubId, [payment.invoice_id]);
      const repository = manager.getRepository(Payment);
      const current = await repository.findOneBy({
        club_id: clubId,
        payment_id: payment.payment_id,
      });
      if (!current) throw new NotFoundException('Payment not found');
      if (current.status === PaymentStatus.CONFIRMED || current.provider_payment_id)
        throw new ConflictException(
          'Confirmed and provider payments are immutable. Use an audited credit or refund.',
        );
      if (
        dto &&
        ((dto.invoice_id && dto.invoice_id !== current.invoice_id) || dto.provider_payment_id)
      )
        throw new BadRequestException('The payment source cannot change');
      if (dto) {
        const { balance, invoice } = await this.invoice(clubId, current.invoice_id, manager);
        const oldReserved = ['pending_submission', 'submitted'].includes(current.status)
          ? minor(current.amount)
          : 0;
        const amount = minor(dto.amount ?? current.amount);
        if (amount <= 0 || amount > balance.collectable_minor + oldReserved)
          throw new ConflictException('Payment exceeds the available balance');
        await repository.update(
          { club_id: clubId, payment_id: current.payment_id },
          {
            ...dto,
            currency: invoice.currency,
            payment_date: dto.payment_date ? new Date(dto.payment_date) : current.payment_date,
          },
        );
      } else await repository.delete({ club_id: clubId, payment_id: current.payment_id });
      await this.syncStatus(manager, clubId, current.invoice_id);
      return dto
        ? repository.findOneByOrFail({ club_id: clubId, payment_id: current.payment_id })
        : null;
    });
  }

  async attach<T extends { club_id: string; invoice_id: string }>(
    invoice: T,
  ): Promise<T & { billing_balance: ReturnType<typeof calculateBalance> }> {
    const [run] = await this.db.query(
      "SELECT snapshot->'calculation'->'tax_inclusive' AS tax_inclusive FROM billing_runs WHERE club_id=$1 AND invoice_id=$2",
      [invoice.club_id, invoice.invoice_id],
    );
    return {
      ...invoice,
      billing_tax_inclusive: run?.tax_inclusive,
      billing_balance: (await this.invoice(invoice.club_id, invoice.invoice_id)).balance,
    };
  }

  async assertInvoiceEditable(clubId: string, invoiceId: string, fields: string[] | null) {
    const [row] = await this.db.query(
      `SELECT EXISTS(SELECT 1 FROM billing_runs WHERE club_id=$1 AND invoice_id=$2 UNION ALL SELECT 1 FROM billing_credit_notes WHERE club_id=$1 AND invoice_id=$2 UNION ALL SELECT 1 FROM billing_payment_operations WHERE club_id=$1 AND invoice_id=$2 UNION ALL SELECT 1 FROM billing_credit_allocations WHERE club_id=$1 AND (source_invoice_id=$2 OR target_invoice_id=$2)) AS audited`,
      [clubId, invoiceId],
    );
    if (row.audited && (!fields || fields.some((field) => !['notes', 'due_date'].includes(field))))
      throw new ConflictException(
        'Use a credit note to change this audited invoice. Only notes and the due date can be edited.',
      );
  }

  async assertBaseFeeEditable(clubId: string, feeId: string) {
    const rows = await this.db.query(
      'SELECT revision_id FROM fee_revisions WHERE club_id=$1 AND fee_structure_id=$2 LIMIT 1',
      [clubId, feeId],
    );
    if (rows.length)
      throw new ConflictException(
        'Schedule an effective-dated fee revision from Billing policies and invoice previews.',
      );
  }

  async assertLegacyGeneration(clubId: string) {
    const [row] = await this.db.query(
      'SELECT EXISTS(SELECT 1 FROM billing_policy_versions WHERE club_id=$1 UNION ALL SELECT 1 FROM fee_revisions WHERE club_id=$1 UNION ALL SELECT 1 FROM billing_runs WHERE club_id=$1) AS configured',
      [clubId],
    );
    if (row.configured)
      throw new ConflictException(
        'Use the billing preview with explicit period dates for this club',
      );
  }

  async queueProviderEvent(
    clubId: string,
    provider: string,
    providerId: string,
    kind: 'refund' | 'collection',
  ) {
    const [rows] = await this.db.query(
      'UPDATE billing_payment_operations SET needs_reconciliation=true,revision=revision+1,updated_at=NOW() WHERE club_id=$1 AND provider=$2 AND provider_id=$3 AND kind=$4 RETURNING operation_id',
      [clubId, provider, providerId, kind],
    );
    return rows.length > 0;
  }

  /** Every mutation that consumes an invoice balance takes the same row lock. */
  async lock(manager: EntityManager, clubId: string, invoiceIds: string[]) {
    const ids = [...new Set(invoiceIds)].sort();
    const rows = await manager.query(
      'SELECT invoice_id FROM invoices WHERE club_id=$1 AND invoice_id=ANY($2::uuid[]) ORDER BY invoice_id FOR UPDATE',
      [clubId, ids],
    );
    if (rows.length !== ids.length) throw new NotFoundException('Invoice not found');
  }

  async syncStatus(manager: EntityManager, clubId: string, invoiceId: string) {
    const { invoice, balance } = await this.invoice(clubId, invoiceId, manager);
    if (['draft', 'cancelled'].includes(invoice.status)) return;
    const status =
      balance.due_minor === 0 ? 'paid' : invoice.status === 'paid' ? 'sent' : invoice.status;
    await manager.query(
      'UPDATE invoices SET status=$3, updated_at=NOW() WHERE club_id=$1 AND invoice_id=$2',
      [clubId, invoiceId, status],
    );
  }
}
