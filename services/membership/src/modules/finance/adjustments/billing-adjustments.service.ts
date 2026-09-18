import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { BillingBalanceService } from './billing-balance.service';
import {
  BillingPolicy,
  calculateBilling,
  canonicalHash,
  ChargeInput,
  days,
  DEFAULT_POLICY,
  minor,
  money,
  roundRatio,
} from './billing-calculator';
import { BillingRunInput, CreditInput } from './billing.schemas';

@Injectable()
export class BillingAdjustmentsService {
  constructor(
    private readonly db: DataSource,
    private readonly balances: BillingBalanceService,
  ) {}

  private async clubLock(manager: EntityManager, clubId: string) {
    await manager.query('SELECT id FROM clubs WHERE id=$1 FOR UPDATE', [clubId]);
  }

  async configuration(clubId: string) {
    return {
      policies: await this.db.query(
        'SELECT * FROM billing_policy_versions WHERE club_id=$1 ORDER BY effective_date DESC',
        [clubId],
      ),
      revisions: await this.db.query(
        'SELECT * FROM fee_revisions WHERE club_id=$1 ORDER BY effective_date DESC',
        [clubId],
      ),
      defaults: DEFAULT_POLICY,
    };
  }

  async savePolicy(
    clubId: string,
    actor: string,
    input: { effective_date: string; policy: BillingPolicy },
  ) {
    return this.db.transaction(async (manager) => {
      await this.clubLock(manager, clubId);
      const feeIds = [...new Set(input.policy.discounts.flatMap((rule) => rule.fee_ids))];
      const fees = await manager.query(
        'SELECT fee_structure_id FROM fee_structures WHERE club_id=$1 AND fee_structure_id=ANY($2::uuid[])',
        [clubId, feeIds],
      );
      if (fees.length !== feeIds.length) throw new BadRequestException('Discount fee not found');
      const existing = await manager.query(
        'SELECT policy_id FROM billing_policy_versions WHERE club_id=$1 AND effective_date=$2',
        [clubId, input.effective_date],
      );
      if (existing.length)
        throw new ConflictException(
          'A policy already starts on this date. Add a new effective date.',
        );
      const [saved] = await manager.query(
        'INSERT INTO billing_policy_versions(club_id,effective_date,policy,actor_id) VALUES($1,$2,$3,$4) RETURNING *',
        [clubId, input.effective_date, input.policy, actor],
      );
      return saved;
    });
  }

  async reviseFee(
    clubId: string,
    actor: string,
    feeId: string,
    input: { effective_date: string; amount: string },
  ) {
    return this.db.transaction(async (manager) => {
      await this.clubLock(manager, clubId);
      const [fee] = await manager.query(
        'SELECT * FROM fee_structures WHERE club_id=$1 AND fee_structure_id=$2 FOR UPDATE',
        [clubId, feeId],
      );
      if (!fee) throw new NotFoundException('Fee not found');
      const existing = await manager.query(
        'SELECT revision_id FROM fee_revisions WHERE club_id=$1 AND fee_structure_id=$2 AND effective_date=$3',
        [clubId, feeId, input.effective_date],
      );
      if (existing.length) throw new ConflictException('A revision already starts on this date');
      const [saved] = await manager.query(
        'INSERT INTO fee_revisions(club_id,fee_structure_id,effective_date,amount_minor,actor_id) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [clubId, feeId, input.effective_date, minor(input.amount), actor],
      );
      return saved;
    });
  }

  async preview(clubId: string, input: BillingRunInput, manager = this.db.manager) {
    days(input.period_start, input.period_end);
    const [club] = await manager.query(
      'SELECT currency,tax_rate,tax_inclusive FROM clubs WHERE id=$1',
      [clubId],
    );
    const [family] = await manager.query(
      'SELECT family_id FROM families WHERE club_id=$1 AND family_id=$2',
      [clubId, input.family_id],
    );
    if (!club || !family) throw new NotFoundException('Family not found');
    const members = await manager.query(
      'SELECT member_id,squad_id,first_name,last_name FROM members WHERE club_id=$1 AND family_id=$2 ORDER BY member_id FOR SHARE',
      [clubId, input.family_id],
    );
    if (
      new Set(input.activity.map((a) => a.member_id)).size !== input.activity.length ||
      input.activity.some(
        (a) => !members.some((m: { member_id: string }) => m.member_id === a.member_id),
      )
    )
      throw new BadRequestException('Invalid family activity dates');
    const fees = await manager.query(
      'SELECT * FROM fee_structures WHERE club_id=$1 AND frequency=$2 AND active=true ORDER BY fee_structure_id FOR SHARE',
      [clubId, input.frequency],
    );
    const revisions = await manager.query(
      'SELECT revision_id,fee_structure_id,effective_date::text,amount_minor FROM fee_revisions WHERE club_id=$1 AND effective_date <= $2 ORDER BY effective_date',
      [clubId, input.period_end],
    );
    const [version] = await manager.query(
      'SELECT policy_id,policy FROM billing_policy_versions WHERE club_id=$1 AND effective_date <= $2 ORDER BY effective_date DESC LIMIT 1',
      [clubId, input.period_start],
    );
    const policy: BillingPolicy = version?.policy ?? DEFAULT_POLICY;
    const charges: ChargeInput[] = [];
    for (const fee of fees) {
      const applicable =
        fee.applies_to_type === 'club'
          ? [null]
          : members.filter((m: { member_id: string; squad_id: string }) =>
              fee.applies_to_type === 'member'
                ? m.member_id === fee.applies_to_id
                : m.squad_id === fee.applies_to_id,
            );
      for (const member of applicable) {
        if (fee.currency !== club.currency)
          throw new BadRequestException('Fee and club currencies differ');
        const activity = input.activity.find((a) => a.member_id === member?.member_id);
        charges.push({
          key: `${fee.fee_structure_id}:${member?.member_id ?? 'family'}`,
          fee_id: fee.fee_structure_id,
          member_id: member?.member_id ?? null,
          // A billable assignment is a fee, not the number of weekly sessions.
          class_id: member ? fee.fee_structure_id : null,
          description:
            `${fee.name}${member ? ` (${member.first_name} ${member.last_name})` : ''}`.slice(
              0,
              255,
            ),
          amount_minor: minor(fee.amount),
          revisions: revisions
            .filter(
              (r: { fee_structure_id: string }) => r.fee_structure_id === fee.fee_structure_id,
            )
            .map((r: { effective_date: string; amount_minor: string; revision_id: string }) => ({
              ...r,
              amount_minor: Number(r.amount_minor),
            })),
          active_start: activity?.active_start ?? input.period_start,
          active_end: activity?.active_end ?? input.period_end,
          session_dates: input.sessions.find((s) => s.fee_id === fee.fee_structure_id)?.dates ?? [],
        });
      }
    }
    if (!charges.length)
      throw new BadRequestException('No applicable fees for this family and frequency');
    if (
      new Set(input.sessions.map((s) => s.fee_id)).size !== input.sessions.length ||
      input.sessions.some((s) => !charges.some((c) => c.fee_id === s.fee_id))
    )
      throw new BadRequestException('Invalid fee session schedule');
    const calculation = calculateBilling({
      ...input,
      policy,
      charges,
      currency: club.currency,
      tax_bp: minor(club.tax_rate ?? 0),
      tax_inclusive: club.tax_inclusive,
    });
    const snapshot = { input, policy_id: version?.policy_id ?? null, policy, calculation };
    return { ...snapshot, preview_hash: canonicalHash(snapshot) };
  }

  async generate(clubId: string, actor: string, input: BillingRunInput, hash: string) {
    return this.db.transaction(async (manager) => {
      await this.clubLock(manager, clubId);
      const [existing] = await manager.query(
        'SELECT * FROM billing_runs WHERE club_id=$1 AND family_id=$2 AND frequency=$3 AND period_start <= $5 AND period_end >= $4',
        [clubId, input.family_id, input.frequency, input.period_start, input.period_end],
      );
      if (existing) {
        if (existing.request_hash === hash)
          return { invoice_id: existing.invoice_id, duplicate: true };
        throw new ConflictException('An invoice already covers this family, frequency and period');
      }
      const preview = await this.preview(clubId, input, manager);
      if (preview.preview_hash !== hash)
        throw new ConflictException('Billing inputs changed. Preview again.');
      const legacy = await manager.query(
        `SELECT invoice_id FROM invoices WHERE club_id=$1 AND family_id=$2 AND fee_structure_id=ANY($3::uuid[]) AND status <> 'cancelled' AND (billing_period=$4 OR billing_period=$5 OR (issued_date BETWEEN $6 AND $7)) LIMIT 1`,
        [
          clubId,
          input.family_id,
          preview.calculation.lines.map((l) => l.fee_id),
          input.period_start.slice(0, 7),
          input.period_start.slice(0, 4),
          input.period_start,
          input.period_end,
        ],
      );
      if (legacy.length)
        throw new ConflictException(
          'An existing generated invoice may cover this period. Resolve it before generating another.',
        );
      const id = randomUUID();
      await manager.query(
        `INSERT INTO invoices(invoice_id,club_id,family_id,invoice_number,subtotal,tax_amount,total_amount,currency,due_date,issued_date,status,billing_period) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE,$10,$11)`,
        [
          id,
          clubId,
          input.family_id,
          `INV-${id}`,
          money(preview.calculation.subtotal_minor),
          money(preview.calculation.tax_minor),
          money(preview.calculation.total_minor),
          preview.calculation.currency,
          input.due_date,
          preview.calculation.total_minor === 0 ? 'paid' : 'pending',
          input.period_start,
        ],
      );
      const items = [];
      for (const line of preview.calculation.lines) {
        const itemId = randomUUID();
        const value = line.total_minor - line.tax_minor;
        await manager.query(
          'INSERT INTO invoice_items(item_id,club_id,invoice_id,description,unit_price,quantity,total,fee_structure_id) VALUES($1,$2,$3,$4,$5,1,$5,$6)',
          [itemId, clubId, id, line.description, money(value), line.fee_id],
        );
        items.push({ item_id: itemId, ...line });
      }
      await manager.query(
        'INSERT INTO billing_runs(club_id,family_id,period_start,period_end,frequency,invoice_id,snapshot,request_hash,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          clubId,
          input.family_id,
          input.period_start,
          input.period_end,
          input.frequency,
          id,
          { ...preview, items },
          hash,
          actor,
        ],
      );
      return { invoice_id: id, duplicate: false };
    });
  }

  async history(clubId: string, invoiceId: string) {
    const { invoice, balance } = await this.balances.invoice(clubId, invoiceId);
    return {
      invoice_id: invoiceId,
      family_id: invoice.family_id,
      currency: invoice.currency,
      balance,
      runs: await this.db.query(
        'SELECT snapshot FROM billing_runs WHERE club_id=$1 AND invoice_id=$2',
        [clubId, invoiceId],
      ),
      credits: await this.db.query(
        'SELECT * FROM billing_credit_notes WHERE club_id=$1 AND invoice_id=$2 ORDER BY created_at,credit_id',
        [clubId, invoiceId],
      ),
      allocations: await this.db.query(
        'SELECT * FROM billing_credit_allocations WHERE club_id=$1 AND (source_invoice_id=$2 OR target_invoice_id=$2) ORDER BY created_at',
        [clubId, invoiceId],
      ),
      operations: await this.db.query(
        'SELECT operation_id,payment_id,kind,amount_minor,currency,provider,state,error,created_at,updated_at FROM billing_payment_operations WHERE club_id=$1 AND invoice_id=$2 ORDER BY created_at',
        [clubId, invoiceId],
      ),
    };
  }

  async creditPreview(
    clubId: string,
    invoiceId: string,
    input: CreditInput,
    manager = this.db.manager,
  ) {
    const { invoice, balance } = await this.balances.invoice(clubId, invoiceId, manager);
    if (['draft', 'cancelled'].includes(invoice.status))
      throw new BadRequestException('Only issued invoices can be credited');
    const [item] = await manager.query(
      'SELECT * FROM invoice_items WHERE club_id=$1 AND invoice_id=$2 AND item_id=$3 FOR SHARE',
      [clubId, invoiceId, input.item_id],
    );
    if (!item) throw new NotFoundException('Invoice line not found');
    const [run] = await manager.query(
      'SELECT snapshot,period_start::text,period_end::text FROM billing_runs WHERE club_id=$1 AND invoice_id=$2',
      [clubId, invoiceId],
    );
    const line = run?.snapshot.items.find((i: { item_id: string }) => i.item_id === input.item_id);
    // Legacy lines get a proportional tax share; the invoice-level cap remains authoritative.
    const cap =
      line?.total_minor ??
      roundRatio(
        BigInt(minor(item.total)) * BigInt(minor(invoice.total_amount)),
        BigInt(Math.max(1, minor(invoice.subtotal))),
      );
    const [used] = await manager.query(
      `SELECT COALESCE(SUM(CASE WHEN kind='credit' THEN amount_minor ELSE -amount_minor END),0) AS amount FROM billing_credit_notes WHERE club_id=$1 AND invoice_id=$2 AND item_id=$3`,
      [clubId, invoiceId, input.item_id],
    );
    let amount: number;
    if (input.kind === 'manual') {
      if (!input.amount) throw new BadRequestException('Enter the credit amount');
      amount = minor(input.amount);
    } else {
      if (!run || !line || !input.start_date || !input.end_date)
        throw new BadRequestException(
          'Policy credits require an invoice calculation and event dates',
        );
      const affected = days(input.start_date, input.end_date);
      const policy: BillingPolicy = run.snapshot.policy;
      let noticeStart = input.start_date;
      if (input.kind === 'injury_pause' && policy.notice_days) {
        if (!input.notice_date) throw new BadRequestException('Enter the date notice was received');
        noticeStart = new Date(Date.parse(input.notice_date) + policy.notice_days * 86400000)
          .toISOString()
          .slice(0, 10);
      }
      const weight = line.segments
        .filter((s: { date: string }) => affected.includes(s.date) && s.date >= noticeStart)
        .reduce((sum: number, s: { amount_minor: number }) => sum + s.amount_minor, 0);
      const fullWeight = line.segments.reduce(
        (sum: number, s: { amount_minor: number }) => sum + s.amount_minor,
        0,
      );
      const rate =
        input.kind === 'injury_pause' ? policy.pause_credit_bp : policy.cancellation_credit_bp;
      amount = fullWeight
        ? roundRatio(BigInt(cap) * BigInt(weight) * BigInt(rate), BigInt(fullWeight) * 10000n)
        : 0;
    }
    if (
      amount <= 0 ||
      amount > cap - Number(used.amount) ||
      amount > minor(invoice.total_amount) - balance.credit_notes_minor
    )
      throw new BadRequestException(
        'Credit exceeds the uncredited charge or the policy allows no credit',
      );
    const snapshot = {
      invoice_id: invoiceId,
      input,
      amount_minor: amount,
      currency: invoice.currency,
      policy_id: run?.snapshot.policy_id ?? null,
      balance,
    };
    return {
      ...snapshot,
      preview_hash: canonicalHash(snapshot),
      resulting_due_minor: Math.max(0, balance.due_minor - amount),
      resulting_credit_minor:
        balance.available_credit_minor + Math.max(0, amount - balance.due_minor),
    };
  }

  async credit(clubId: string, actor: string, invoiceId: string, input: CreditInput, hash: string) {
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `credit:${clubId}:${input.source_event}`,
      ]);
      await this.balances.lock(manager, clubId, [invoiceId]);
      const [existing] = await manager.query(
        'SELECT * FROM billing_credit_notes WHERE club_id=$1 AND source_event=$2',
        [clubId, input.source_event],
      );
      if (existing) {
        if (existing.request_hash === hash && existing.invoice_id === invoiceId) return existing;
        throw new ConflictException('This event already has a different credit');
      }
      const preview = await this.creditPreview(clubId, invoiceId, input, manager);
      if (preview.preview_hash !== hash)
        throw new ConflictException('The invoice changed. Preview again.');
      const [credit] = await manager.query(
        `INSERT INTO billing_credit_notes(club_id,invoice_id,item_id,amount_minor,currency,kind,reason,source_event,snapshot,request_hash,actor_id) VALUES($1,$2,$3,$4,$5,'credit',$6,$7,$8,$9,$10) RETURNING *`,
        [
          clubId,
          invoiceId,
          input.item_id,
          preview.amount_minor,
          preview.currency,
          input.reason,
          input.source_event,
          preview,
          hash,
          actor,
        ],
      );
      await this.balances.syncStatus(manager, clubId, invoiceId);
      return credit;
    });
  }

  async reverse(
    clubId: string,
    actor: string,
    invoiceId: string,
    creditId: string,
    reason: string,
  ) {
    return this.db.transaction(async (manager) => {
      await this.balances.lock(manager, clubId, [invoiceId]);
      const [credit] = await manager.query(
        "SELECT * FROM billing_credit_notes WHERE club_id=$1 AND invoice_id=$2 AND credit_id=$3 AND kind='credit'",
        [clubId, invoiceId, creditId],
      );
      if (!credit) throw new NotFoundException('Credit not found');
      const [existing] = await manager.query(
        'SELECT * FROM billing_credit_notes WHERE club_id=$1 AND reverses_id=$2',
        [clubId, creditId],
      );
      if (existing) return existing;
      const { balance } = await this.balances.invoice(clubId, invoiceId, manager);
      // Once credit is transferred or reserved for refund it cannot be undone locally.
      if (balance.allocated_out_minor || balance.refunded_minor || balance.reserved_refunds_minor)
        throw new ConflictException('Transferred or refunded credit cannot be reversed');
      const [saved] = await manager.query(
        `INSERT INTO billing_credit_notes(club_id,invoice_id,item_id,amount_minor,currency,kind,reverses_id,reason,source_event,snapshot,request_hash,actor_id) VALUES($1,$2,$3,$4,$5,'reversal',$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          clubId,
          invoiceId,
          credit.item_id,
          credit.amount_minor,
          credit.currency,
          creditId,
          reason,
          `reversal:${creditId}`,
          { credit_id: creditId },
          canonicalHash({ creditId, reason }),
          actor,
        ],
      );
      await this.balances.syncStatus(manager, clubId, invoiceId);
      return saved;
    });
  }

  async allocate(
    clubId: string,
    actor: string,
    source: string,
    target: string,
    amount: number,
    sourceEvent: string,
  ) {
    if (source === target || amount <= 0)
      throw new BadRequestException('Choose another invoice and a positive amount');
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `allocation:${clubId}:${sourceEvent}`,
      ]);
      await this.balances.lock(manager, clubId, [source, target]);
      const [existing] = await manager.query(
        'SELECT * FROM billing_credit_allocations WHERE club_id=$1 AND source_event=$2',
        [clubId, sourceEvent],
      );
      if (existing) {
        if (
          existing.source_invoice_id !== source ||
          existing.target_invoice_id !== target ||
          Number(existing.amount_minor) !== amount
        )
          throw new ConflictException('Allocation reference already used');
        return existing;
      }
      const from = await this.balances.invoice(clubId, source, manager);
      const to = await this.balances.invoice(clubId, target, manager);
      if (
        from.invoice.family_id !== to.invoice.family_id ||
        from.invoice.currency !== to.invoice.currency ||
        ['draft', 'cancelled'].includes(to.invoice.status)
      )
        throw new BadRequestException(
          'Credit must stay with the same family and currency on an issued invoice',
        );
      if (amount > from.balance.available_credit_minor || amount > to.balance.collectable_minor)
        throw new ConflictException('Available credit or outstanding balance changed');
      const [saved] = await manager.query(
        'INSERT INTO billing_credit_allocations(club_id,source_invoice_id,target_invoice_id,amount_minor,actor_id,source_event) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [clubId, source, target, amount, actor, sourceEvent],
      );
      await this.balances.syncStatus(manager, clubId, target);
      return saved;
    });
  }
}
