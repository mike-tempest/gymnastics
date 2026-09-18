import Stripe from 'stripe';
import { StripeProvider } from './stripe.provider';
import { GoCardlessProvider } from './gocardless.provider';
import { GoCardlessService } from '../../gocardless/gocardless.service';
import { ProviderConnection } from './payment-provider.interface';
const connection: ProviderConnection = {
  clubId: 'club',
  provider: 'stripe',
  externalAccountId: 'acct_club',
  source: 'connection',
  livemode: false,
};
const params = {
  providerPaymentId: 'pi_original',
  amountMinor: 1234,
  totalRefundedMinor: 2234,
  operationId: 'operation',
};
describe('club-bound refunds', () => {
  it('sends Stripe the original payment, exact minor units and stable operation key on the club account', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 're_1',
      amount: 1234,
      currency: 'gbp',
      status: 'pending',
      payment_intent: 'pi_original',
      metadata: { billing_operation_id: 'operation' },
    });
    const provider = new StripeProvider(connection, { refunds: { create } } as unknown as Stripe);
    expect(await provider.refund(params)).toMatchObject({
      id: 're_1',
      amountMinor: 1234,
      state: 'pending',
      paymentId: 'pi_original',
    });
    expect(create).toHaveBeenCalledWith(
      {
        payment_intent: 'pi_original',
        amount: 1234,
        metadata: { billing_operation_id: 'operation' },
      },
      { stripeAccount: 'acct_club', idempotencyKey: 'operation' },
    );
  });
  it.each([
    ['succeeded', 'confirmed'],
    ['failed', 'failed'],
    ['canceled', 'failed'],
    ['requires_action', 'pending'],
  ])('maps Stripe %s without mistaking submission for settlement', (status, state) => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 're_1',
      amount: 100,
      currency: 'gbp',
      status,
      payment_intent: 'pi_original',
    });
    const provider = new StripeProvider(connection, { refunds: { retrieve } } as unknown as Stripe);
    return expect(provider.inspectRefund('re_1')).resolves.toMatchObject({ state });
  });
  it('distinguishes a definitive Stripe rejection from an unknown transport outcome', async () => {
    const create = jest
      .fn()
      .mockRejectedValue({ type: 'StripeInvalidRequestError', statusCode: 400 });
    const provider = new StripeProvider(connection, { refunds: { create } } as unknown as Stripe);
    await expect(provider.refund(params)).rejects.toThrow('Stripe rejected');
    create.mockRejectedValue(new Error('Socket timeout'));
    await expect(provider.refund(params)).rejects.toThrow('Socket timeout');
  });
  it('finds a lost Stripe refund by metadata without resubmitting', async () => {
    const list = jest.fn().mockReturnValue(
      (async function* () {
        yield { id: 'other', metadata: {} };
        yield {
          id: 're_saved',
          amount: 1234,
          currency: 'gbp',
          status: 'succeeded',
          payment_intent: 'pi_original',
          metadata: { billing_operation_id: 'operation' },
        };
      })(),
    );
    const provider = new StripeProvider(connection, { refunds: { list } } as unknown as Stripe);
    await expect(
      provider.findOperation({
        kind: 'refund',
        operationId: 'operation',
        providerPaymentId: 'pi_original',
        createdAt: '2026-09-16T00:00:00Z',
      }),
    ).resolves.toMatchObject({ id: 're_saved', state: 'confirmed' });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ payment_intent: 'pi_original' }), {
      stripeAccount: 'acct_club',
    });
  });
  it('passes the cumulative confirmation total to GoCardless', async () => {
    const createBillingRefund = jest.fn().mockResolvedValue({
      id: 'RF1',
      amount: '1234',
      currency: 'GBP',
      status: 'created',
      links: { payment: 'pi_original' },
      metadata: { billing_operation_id: 'operation' },
    });
    const provider = new GoCardlessProvider({ ...connection, provider: 'gocardless' }, {
      createBillingRefund,
    } as unknown as GoCardlessService);
    await expect(provider.refund(params)).resolves.toMatchObject({ state: 'pending' });
    expect(createBillingRefund).toHaveBeenCalledWith(params);
  });
  it.each([
    ['paid', 'confirmed'],
    ['bounced', 'failed'],
    ['funds_returned', 'failed'],
    ['submitted', 'pending'],
  ])('maps GoCardless %s', (status, state) => {
    const getBillingRefund = jest
      .fn()
      .mockResolvedValue({ id: 'RF1', amount: '100', currency: 'GBP', status });
    const provider = new GoCardlessProvider({ ...connection, provider: 'gocardless' }, {
      getBillingRefund,
    } as unknown as GoCardlessService);
    return expect(provider.inspectRefund('RF1')).resolves.toMatchObject({ state });
  });
});
