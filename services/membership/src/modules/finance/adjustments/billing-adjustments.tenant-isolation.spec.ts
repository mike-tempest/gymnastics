import { EmailService } from '../../email/email.service';
import { join } from 'path';
import { PaymentMethod, PaymentStatus } from '../payments/entities/payment.entity';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { BillingAdjustmentsService } from './billing-adjustments.service';
import { BillingBalanceService } from './billing-balance.service';
import { PaymentOperationsService } from './payment-operations.service';
import { DEFAULT_POLICY } from './billing-calculator';
import { PaymentProviderRegistry } from '../payment-providers/payment-provider.registry';
import { BillingRunInput } from './billing.schemas';
import {
  ProviderSubmissionRejectedError,
  PaymentProvider,
  ProviderOperationResult,
} from '../payment-providers/payment-provider.interface';

const databaseUrl = process.env.TEM59_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
integration('billing ledger PostgreSQL concurrency and tenant isolation', () => {
  let db: DataSource;
  let billing: BillingAdjustmentsService;
  let balances: BillingBalanceService;
  let operations: PaymentOperationsService;
  const club = randomUUID(),
    otherClub = randomUUID(),
    family = randomUUID(),
    otherFamily = randomUUID(),
    fee = randomUUID(),
    actor = randomUUID();
  const email = {
    sendPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
    sendPaymentFailed: jest.fn().mockResolvedValue(undefined),
  };
  const remote = new Map<string, ProviderOperationResult>();
  let failAfterSubmit = false;
  let rejectSubmission = false;
  let chargeCalls = 0;
  let refundCalls = 0;
  const provider: PaymentProvider = {
    connection: {
      clubId: club,
      provider: 'stripe',
      externalAccountId: 'acct_test_billing',
      source: 'connection',
      livemode: false,
    },
    startMandateSetup: jest.fn(),
    completeMandateSetup: jest.fn(),
    getMandateStatus: jest.fn(),
    cancelMandate: jest.fn(),
    chargeRecurring: async (params) => {
      chargeCalls++;
      const result: ProviderOperationResult = {
        id: `pi_${params.idempotencyKey}`,
        amountMinor: Math.round(params.amount * 100),
        currency: params.currency,
        state: 'confirmed',
        operationId: params.idempotencyKey,
        refundedMinor: 0,
      };
      remote.set(result.id, result);
      if (failAfterSubmit) throw new Error('Timeout after submission');
      return { providerPaymentId: result.id };
    },
    inspectPayment: async (id) => {
      const result = remote.get(id);
      if (!result) throw new Error('Missing payment');
      return { ...result };
    },
    inspectRefund: async (id) => {
      const result = remote.get(id);
      if (!result) throw new Error('Missing refund');
      return { ...result };
    },
    refund: async (params) => {
      refundCalls++;
      if (rejectSubmission)
        throw new ProviderSubmissionRejectedError('Provider explicitly rejected the refund');
      const result: ProviderOperationResult = {
        id: `re_${params.operationId}`,
        amountMinor: params.amountMinor,
        currency: 'GBP',
        state: 'confirmed',
        operationId: params.operationId,
        paymentId: params.providerPaymentId,
      };
      remote.set(result.id, result);
      remote.get(params.providerPaymentId)!.refundedMinor = params.totalRefundedMinor;
      if (failAfterSubmit) throw new Error('Timeout after refund');
      return result;
    },
    findOperation: async (lookup) =>
      [...remote.values()].find((r) => r.operationId === lookup.operationId) ?? null,
  };
  const run = (month: string): BillingRunInput => ({
    family_id: family,
    frequency: 'monthly',
    period_start: `2028-${month}-01`,
    period_end: `2028-${month}-28`,
    due_date: `2028-${month}-28`,
    activity: [],
    sessions: [],
  });
  const invoice = async (month: string) => {
    const input = run(month);
    const preview = await billing.preview(club, input);
    return (await billing.generate(club, actor, input, preview.preview_hash)).invoice_id;
  };
  const credit = async (id: string, amount = '20.00', source = randomUUID()) => {
    const [item] = await db.query('SELECT item_id FROM invoice_items WHERE invoice_id=$1', [id]);
    const input = {
      item_id: item.item_id,
      kind: 'manual' as const,
      amount,
      reason: 'Approved club cancellation',
      source_event: source,
    };
    const preview = await billing.creditPreview(club, id, input);
    return { input, preview };
  };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/tumblebase_tem55')
      throw new Error('Use the named disposable local database');
    db = await new DataSource({
      type: 'postgres',
      url: databaseUrl,
      entities: [join(__dirname, '../../../**/*.entity.ts')],
    }).initialize();
    await db.query('INSERT INTO clubs(id,name,slug) VALUES($1,$2,$3),($4,$5,$6)', [
      club,
      'Billing checks',
      `tem59-${club}`,
      otherClub,
      'Other club',
      `tem59-${otherClub}`,
    ]);
    await db.query(
      'INSERT INTO families(family_id,club_id,family_name,primary_contact_name,primary_contact_email) VALUES($1,$2,$3,$3,$4),($5,$6,$7,$7,$8)',
      [
        family,
        club,
        'Billing family',
        'billing@example.test',
        otherFamily,
        otherClub,
        'Other family',
        'other@example.test',
      ],
    );
    await db.query(
      "INSERT INTO fee_structures(fee_structure_id,club_id,name,amount,currency,frequency,applies_to_type,active) VALUES($1,$2,'Monthly fee',100,'GBP','monthly','club',true)",
      [fee, club],
    );
    await db.query(
      "INSERT INTO direct_debit_mandates(club_id,family_id,provider,provider_mandate_id,provider_customer_id,status) VALUES($1,$2,'stripe','pm_' || $3,'cus_' || $3,'active')",
      [club, family, randomUUID()],
    );
    balances = new BillingBalanceService(db);
    billing = new BillingAdjustmentsService(db, balances);
    operations = new PaymentOperationsService(
      db,
      balances,
      {
        forClub: async (id: string) => {
          if (id !== club) throw new Error('Wrong club');
          return provider;
        },
      } as PaymentProviderRegistry,
      email as unknown as EmailService,
    );
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  it('rejects family, fee and invoice access across clubs', async () => {
    await expect(billing.preview(club, { ...run('01'), family_id: otherFamily })).rejects.toThrow(
      'Family not found',
    );
    await expect(
      billing.reviseFee(otherClub, actor, fee, { effective_date: '2028-01-01', amount: '12.00' }),
    ).rejects.toThrow('Fee not found');
    const id = await invoice('01');
    await expect(billing.history(otherClub, id)).rejects.toThrow('Invoice not found');
  });
  it('rejects stale previews and freezes the accepted revision', async () => {
    const input = run('02');
    const original = await billing.preview(club, input);
    await billing.reviseFee(club, actor, fee, { effective_date: '2028-02-15', amount: '120.00' });
    await expect(billing.generate(club, actor, input, original.preview_hash)).rejects.toThrow(
      'changed',
    );
    const preview = await billing.preview(club, input);
    expect(preview.calculation.total_minor).toBe(11000);
    const generated = await billing.generate(club, actor, input, preview.preview_hash);
    expect((await billing.generate(club, actor, input, preview.preview_hash)).invoice_id).toBe(
      generated.invoice_id,
    );
    await expect(
      db.query('UPDATE invoices SET total_amount=1 WHERE invoice_id=$1', [generated.invoice_id]),
    ).rejects.toThrow('credit note');
    await expect(
      db.query('UPDATE invoice_items SET total=1 WHERE invoice_id=$1', [generated.invoice_id]),
    ).rejects.toThrow('immutable');
  });
  it('serialises concurrent credit commits and permits an idempotent event replay', async () => {
    const id = await invoice('03');
    const { input, preview } = await credit(id, '90.00');
    const results = await Promise.all([
      billing.credit(club, actor, id, input, preview.preview_hash),
      billing.credit(club, actor, id, input, preview.preview_hash),
    ]);
    expect(results[0].credit_id).toBe(results[1].credit_id);
    expect((await balances.invoice(club, id)).balance.due_minor).toBe(3000);
    await expect(
      billing.credit(
        club,
        actor,
        id,
        { ...input, source_event: randomUUID() },
        preview.preview_hash,
      ),
    ).rejects.toThrow();
    await expect(
      db.query('DELETE FROM billing_credit_notes WHERE invoice_id=$1', [id]),
    ).rejects.toThrow('append-only');
  });
  it('never sends a second charge after a provider timeout', async () => {
    const id = await invoice('04');
    failAfterSubmit = true;
    chargeCalls = 0;
    const first = await operations.collect(club, id);
    expect(first?.state).toBe('uncertain');
    expect((await balances.invoice(club, id)).balance.collectable_minor).toBe(0);
    failAfterSubmit = false;
    const next = await operations.collect(club, id);
    expect(next?.state).toBe('confirmed');
    expect(chargeCalls).toBe(1);
    expect((await balances.invoice(club, id)).balance.paid_minor).toBe(12000);
    await operations.collect(club, id);
    expect(chargeCalls).toBe(1);
  });
  it('reserves a refund, reconciles timeout, and does not reopen the debt', async () => {
    const id = await invoice('05');
    const collection = await operations.collect(club, id);
    const { input, preview } = await credit(id, '30.00');
    await billing.credit(club, actor, id, input, preview.preview_hash);
    const previewRefund = await operations.refundPreview(
      club,
      id,
      collection!.payment_id!,
      3000,
      'Return cancelled session fees',
    );
    failAfterSubmit = true;
    refundCalls = 0;
    const operationId = randomUUID();
    const result = await operations.refund(
      club,
      actor,
      id,
      collection!.payment_id!,
      3000,
      'Return cancelled session fees',
      operationId,
      previewRefund.preview_hash,
    );
    expect(result.state).toBe('uncertain');
    expect((await balances.invoice(club, id)).balance.available_credit_minor).toBe(0);
    failAfterSubmit = false;
    await operations.reconcile(club, operationId);
    expect(refundCalls).toBe(1);
    expect((await balances.invoice(club, id)).balance).toMatchObject({
      due_minor: 0,
      refunded_minor: 3000,
      available_credit_minor: 0,
    });
    await expect(
      billing.reverse(
        club,
        actor,
        id,
        (await billing.history(club, id)).credits[0].credit_id,
        'Reverse refunded credit',
      ),
    ).rejects.toThrow('cannot be reversed');
  });
  it('allocates credit once within the family and currency', async () => {
    const source = await invoice('06');
    const target = await invoice('07');
    await operations.collect(club, source);
    const { input, preview } = await credit(source, '40.00');
    await billing.credit(club, actor, source, input, preview.preview_hash);
    const key = randomUUID();
    await billing.allocate(club, actor, source, target, 4000, key);
    await billing.allocate(club, actor, source, target, 4000, key);
    expect((await balances.invoice(club, target)).balance.due_minor).toBe(8000);
    expect((await balances.invoice(club, source)).balance.available_credit_minor).toBe(0);
    await expect(billing.allocate(club, actor, source, target, 1, randomUUID())).rejects.toThrow(
      'changed',
    );
  });
  it('uses the saved cancellation policy instead of later policy changes', async () => {
    await billing.savePolicy(club, actor, {
      effective_date: '2028-08-01',
      policy: { ...DEFAULT_POLICY, proration: 'days', cancellation_credit_bp: 10000 },
    });
    const id = await invoice('08');
    await billing.savePolicy(club, actor, { effective_date: '2028-08-15', policy: DEFAULT_POLICY });
    const [item] = await db.query('SELECT item_id FROM invoice_items WHERE invoice_id=$1', [id]);
    const preview = await billing.creditPreview(club, id, {
      item_id: item.item_id,
      kind: 'club_cancellation',
      start_date: '2028-08-01',
      end_date: '2028-08-14',
      reason: 'Club venue closure',
      source_event: randomUUID(),
    });
    expect(preview.amount_minor).toBe(6000);
  });
  it('serialises simultaneous collectors into one provider operation', async () => {
    const id = await invoice('09');
    chargeCalls = 0;
    email.sendPaymentConfirmed.mockClear();
    await Promise.all([operations.collect(club, id), operations.collect(club, id)]);
    expect(chargeCalls).toBe(1);
    expect(email.sendPaymentConfirmed).toHaveBeenCalledTimes(1);
    expect((await balances.invoice(club, id)).balance.collectable_minor).toBe(0);
  });
  it('prevents concurrent refunds spending the same credit, then releases a confirmed failure', async () => {
    const id = await invoice('10');
    const collection = await operations.collect(club, id);
    const c = await credit(id, '30.00');
    await billing.credit(club, actor, id, c.input, c.preview.preview_hash);
    const preview = await operations.refundPreview(
      club,
      id,
      collection!.payment_id!,
      3000,
      'Return cancelled fees',
    );
    refundCalls = 0;
    const results = await Promise.allSettled([
      operations.refund(
        club,
        actor,
        id,
        collection!.payment_id!,
        3000,
        'Return cancelled fees',
        randomUUID(),
        preview.preview_hash,
      ),
      operations.refund(
        club,
        actor,
        id,
        collection!.payment_id!,
        3000,
        'Return cancelled fees',
        randomUUID(),
        preview.preview_hash,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(refundCalls).toBe(1);
    const [op] = await db.query(
      "SELECT * FROM billing_payment_operations WHERE invoice_id=$1 AND kind='refund'",
      [id],
    );
    remote.get(op.provider_id)!.state = 'failed';
    remote.get(collection!.provider_id!)!.refundedMinor = 0;
    expect(await balances.queueProviderEvent(club, 'stripe', op.provider_id, 'refund')).toBe(true);
    await operations.reconcile(club, op.operation_id);
    expect((await balances.invoice(club, id)).balance).toMatchObject({
      available_credit_minor: 3000,
      refunded_minor: 0,
      due_minor: 0,
    });
  });
  it('rejects a changed provider account and ignores another club’s webhook', async () => {
    const id = await invoice('11');
    const collection = await operations.collect(club, id);
    const c = await credit(id, '20.00');
    await billing.credit(club, actor, id, c.input, c.preview.preview_hash);
    provider.connection.externalAccountId = 'acct_other';
    try {
      await expect(
        operations.refundPreview(club, id, collection!.payment_id!, 2000, 'Return cancelled fees'),
      ).rejects.toThrow('original payment account');
    } finally {
      provider.connection.externalAccountId = 'acct_test_billing';
    }
    expect(
      await balances.queueProviderEvent(
        otherClub,
        'stripe',
        collection!.provider_id!,
        'collection',
      ),
    ).toBe(false);
    expect(
      await balances.queueProviderEvent(club, 'stripe', collection!.provider_id!, 'collection'),
    ).toBe(true);
    await operations.reconcile(club, collection!.operation_id);
    expect((await balances.invoice(club, id)).balance.paid_minor).toBe(12000);
  });
  it('serialises manual payments and forbids editing confirmed cash', async () => {
    const id = await invoice('12');
    const dto = {
      invoice_id: id,
      amount: 80,
      payment_method: PaymentMethod.CASH,
      status: PaymentStatus.CONFIRMED,
    };
    const results = await Promise.allSettled([
      balances.recordManual(club, dto),
      balances.recordManual(club, dto),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await balances.invoice(club, id)).balance.due_minor).toBe(4000);
    const payment = results.find((r) => r.status === 'fulfilled');
    if (payment?.status !== 'fulfilled') throw new Error('No recorded payment');
    await expect(balances.mutateManual(club, payment.value, { amount: 1 })).rejects.toThrow(
      'immutable',
    );
  });
  it('releases a refund reservation only after a definitive submission rejection', async () => {
    const input = {
      ...run('01'),
      period_start: '2029-01-01',
      period_end: '2029-01-28',
      due_date: '2029-01-28',
    };
    const preview = await billing.preview(club, input);
    const id = (await billing.generate(club, actor, input, preview.preview_hash)).invoice_id;
    const collection = await operations.collect(club, id);
    const c = await credit(id, '30.00');
    await billing.credit(club, actor, id, c.input, c.preview.preview_hash);
    const refundPreview = await operations.refundPreview(
      club,
      id,
      collection!.payment_id!,
      3000,
      'Return cancelled fees',
    );
    rejectSubmission = true;
    try {
      const result = await operations.refund(
        club,
        actor,
        id,
        collection!.payment_id!,
        3000,
        'Return cancelled fees',
        randomUUID(),
        refundPreview.preview_hash,
      );
      expect(result.state).toBe('failed');
      expect((await balances.invoice(club, id)).balance.available_credit_minor).toBe(3000);
    } finally {
      rejectSubmission = false;
    }
  });
});
