import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotImplementedException } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeProvider, StripeProviderFactory } from './stripe.provider';
import { ProviderConnection } from './payment-provider.interface';

describe('StripeProvider', () => {
  const connection: ProviderConnection = {
    clubId: 'club-1',
    provider: 'stripe',
    externalAccountId: 'acct_club1',
    livemode: true,
    source: 'connection',
  };

  const paymentIntents = { create: jest.fn() };
  const customers = { create: jest.fn() };
  const checkoutSessions = { create: jest.fn(), retrieve: jest.fn() };
  const paymentMethods = { retrieve: jest.fn(), detach: jest.fn() };
  const stripe = {
    paymentIntents,
    customers,
    paymentMethods,
    checkout: { sessions: checkoutSessions },
  } as unknown as Stripe;

  /** An error shaped like the SDK's invalid-request rejection. */
  const invalidRequestError = (message: string, code?: string) =>
    Object.assign(new Error(message), { type: 'StripeInvalidRequestError', code });

  let provider: StripeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new StripeProvider(connection, stripe);
  });

  it('exposes the connection it is bound to', () => {
    expect(provider.connection).toBe(connection);
  });

  describe('chargeRecurring', () => {
    it('creates an off-session PaymentIntent on the connected account', async () => {
      paymentIntents.create.mockResolvedValue({ id: 'pi_999' });

      const result = await provider.chargeRecurring({
        amount: 42.5,
        currency: 'AUD',
        providerMandateId: 'pm_abc',
        providerCustomerId: 'cus_abc',
        idempotencyKey: 'invoice-inv-1-4250',
        description: 'Payment for invoice INV-1',
        metadata: { invoice_id: 'inv-1' },
      });

      expect(paymentIntents.create).toHaveBeenCalledWith(
        {
          // Major units converted to minor units.
          amount: 4250,
          currency: 'aud',
          customer: 'cus_abc',
          payment_method: 'pm_abc',
          off_session: true,
          confirm: true,
          description: 'Payment for invoice INV-1',
          metadata: { invoice_id: 'inv-1' },
        },
        {
          // The direct-charge header routes the money to the club's account.
          stripeAccount: 'acct_club1',
          idempotencyKey: 'invoice-inv-1-4250',
        },
      );
      expect(result).toEqual({ providerPaymentId: 'pi_999' });
    });

    it('rounds to the nearest minor unit rather than truncating', async () => {
      paymentIntents.create.mockResolvedValue({ id: 'pi_1' });

      await provider.chargeRecurring({
        amount: 19.999,
        currency: 'GBP',
        providerMandateId: 'pm_1',
        providerCustomerId: 'cus_1',
      });

      expect(paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2000 }),
        expect.anything(),
      );
    });

    it('refuses to charge without the customer the payment method belongs to', async () => {
      // Stripe cannot charge a bare payment method off-session, unlike GoCardless
      // charging a mandate directly.
      await expect(
        provider.chargeRecurring({
          amount: 10,
          currency: 'GBP',
          providerMandateId: 'pm_1',
        }),
      ).rejects.toThrow(NotImplementedException);

      expect(paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  describe('startMandateSetup', () => {
    beforeEach(() => {
      customers.create.mockResolvedValue({ id: 'cus_new' });
      checkoutSessions.create.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/c/pay/cs_123',
      });
    });

    it('creates a customer and a setup-mode Checkout session on the connected account', async () => {
      const result = await provider.startMandateSetup({
        sessionToken: 'tok-1',
        successRedirectUrl: 'https://app.swimly.uk/billing/setup',
        description: 'Set up Direct Debit for swim club membership fees',
        scheme: 'bacs',
      });

      expect(customers.create).toHaveBeenCalledWith(
        { description: 'Set up Direct Debit for swim club membership fees' },
        { stripeAccount: 'acct_club1' },
      );
      expect(checkoutSessions.create).toHaveBeenCalledWith(
        {
          mode: 'setup',
          customer: 'cus_new',
          payment_method_types: ['bacs_debit', 'card'],
          // Stripe substitutes the literal placeholder, which is how the
          // frontend learns the flow id, mirroring GoCardless's
          // redirect_flow_id round-trip.
          success_url: 'https://app.swimly.uk/billing/setup?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://app.swimly.uk/billing/setup',
          metadata: { session_token: 'tok-1' },
        },
        { stripeAccount: 'acct_club1' },
      );
      expect(result).toEqual({
        flowId: 'cs_123',
        redirectUrl: 'https://checkout.stripe.com/c/pay/cs_123',
      });
    });

    it('appends the session id with & when the success URL already has a query', async () => {
      await provider.startMandateSetup({
        sessionToken: 'tok-1',
        successRedirectUrl: 'https://app.swimly.uk/billing/setup?family=fam-1',
      });

      expect(checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url:
            'https://app.swimly.uk/billing/setup?family=fam-1&session_id={CHECKOUT_SESSION_ID}',
        }),
        expect.anything(),
      );
    });

    it.each([
      ['becs', ['au_becs_debit', 'card']],
      ['ach', ['us_bank_account', 'card']],
      ['pad', ['acss_debit', 'card']],
      ['sepa_core', ['sepa_debit', 'card']],
    ])('maps scheme %s to its bank-debit payment method types', async (scheme, expected) => {
      await provider.startMandateSetup({
        sessionToken: 'tok-1',
        successRedirectUrl: 'https://app.swimly.uk/setup',
        scheme,
      });

      expect(checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_method_types: expected }),
        expect.anything(),
      );
    });

    it('falls back to card only for an unknown scheme', async () => {
      await provider.startMandateSetup({
        sessionToken: 'tok-1',
        successRedirectUrl: 'https://app.swimly.uk/setup',
        scheme: 'giro',
      });

      expect(checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_method_types: ['card'] }),
        expect.anything(),
      );
    });

    it('reuses an existing customer instead of creating a duplicate', async () => {
      await provider.startMandateSetup({
        sessionToken: 'tok-1',
        successRedirectUrl: 'https://app.swimly.uk/setup',
        existingProviderCustomerId: 'cus_existing',
      });

      expect(customers.create).not.toHaveBeenCalled();
      expect(checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing' }),
        expect.anything(),
      );
    });

    it('retries once with card only when the bank-debit capability is rejected', async () => {
      // A connected account without the bacs_debit capability active makes
      // Stripe reject the session; card is universal, so the payer still gets
      // a working setup page.
      checkoutSessions.create
        .mockRejectedValueOnce(
          invalidRequestError('The payment method type "bacs_debit" is invalid'),
        )
        .mockResolvedValueOnce({ id: 'cs_retry', url: 'https://checkout.stripe.com/cs_retry' });

      const result = await provider.startMandateSetup({
        sessionToken: 'tok-1',
        successRedirectUrl: 'https://app.swimly.uk/setup',
        scheme: 'bacs',
      });

      expect(checkoutSessions.create).toHaveBeenCalledTimes(2);
      expect(checkoutSessions.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ payment_method_types: ['card'] }),
        { stripeAccount: 'acct_club1' },
      );
      expect(result.flowId).toBe('cs_retry');
    });

    it('does not retry a non-capability failure', async () => {
      checkoutSessions.create.mockRejectedValue(
        Object.assign(new Error('rate limited'), { type: 'StripeRateLimitError' }),
      );

      await expect(
        provider.startMandateSetup({
          sessionToken: 'tok-1',
          successRedirectUrl: 'https://app.swimly.uk/setup',
          scheme: 'bacs',
        }),
      ).rejects.toThrow('rate limited');
      expect(checkoutSessions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('completeMandateSetup', () => {
    const completeSession = (overrides: Record<string, unknown> = {}) => ({
      id: 'cs_123',
      status: 'complete',
      customer: 'cus_1',
      metadata: { session_token: 'tok-1' },
      setup_intent: {
        id: 'seti_1',
        status: 'succeeded',
        payment_method: { id: 'pm_1' },
      },
      ...overrides,
    });

    it('returns the payment method and customer from a completed session', async () => {
      checkoutSessions.retrieve.mockResolvedValue(completeSession());

      const result = await provider.completeMandateSetup({
        flowId: 'cs_123',
        sessionToken: 'tok-1',
      });

      // Retrieved on the CONNECTED account, expanding through to the payment
      // method that becomes the chargeable mandate handle.
      expect(checkoutSessions.retrieve).toHaveBeenCalledWith(
        'cs_123',
        { expand: ['setup_intent.payment_method'] },
        { stripeAccount: 'acct_club1' },
      );
      expect(result).toEqual({ providerMandateId: 'pm_1', providerCustomerId: 'cus_1' });
    });

    it('rejects a session token mismatch', async () => {
      // The token round-trip is what stops one caller claiming another
      // caller's flow.
      checkoutSessions.retrieve.mockResolvedValue(completeSession());

      await expect(
        provider.completeMandateSetup({ flowId: 'cs_123', sessionToken: 'tok-WRONG' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a session the payer has not completed', async () => {
      checkoutSessions.retrieve.mockResolvedValue(
        completeSession({ status: 'open', setup_intent: { status: 'requires_payment_method' } }),
      );

      await expect(
        provider.completeMandateSetup({ flowId: 'cs_123', sessionToken: 'tok-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles an unexpanded string payment method', async () => {
      checkoutSessions.retrieve.mockResolvedValue(
        completeSession({
          setup_intent: { id: 'seti_1', status: 'succeeded', payment_method: 'pm_string' },
        }),
      );

      const result = await provider.completeMandateSetup({
        flowId: 'cs_123',
        sessionToken: 'tok-1',
      });

      expect(result.providerMandateId).toBe('pm_string');
    });
  });

  describe('getMandateStatus', () => {
    it('reports a payment method attached to a customer as active', async () => {
      paymentMethods.retrieve.mockResolvedValue({ id: 'pm_1', customer: 'cus_1' });

      await expect(provider.getMandateStatus('pm_1')).resolves.toBe('active');
      expect(paymentMethods.retrieve).toHaveBeenCalledWith(
        'pm_1',
        {},
        { stripeAccount: 'acct_club1' },
      );
    });

    it('reports a detached payment method as cancelled', async () => {
      paymentMethods.retrieve.mockResolvedValue({ id: 'pm_1', customer: null });

      await expect(provider.getMandateStatus('pm_1')).resolves.toBe('cancelled');
    });

    it('reports a missing payment method as cancelled', async () => {
      paymentMethods.retrieve.mockRejectedValue(
        invalidRequestError('No such payment method', 'resource_missing'),
      );

      await expect(provider.getMandateStatus('pm_gone')).resolves.toBe('cancelled');
    });

    it('rethrows a non-missing failure', async () => {
      paymentMethods.retrieve.mockRejectedValue(new Error('network down'));

      await expect(provider.getMandateStatus('pm_1')).rejects.toThrow('network down');
    });
  });

  describe('cancelMandate', () => {
    it('detaches the payment method on the connected account', async () => {
      paymentMethods.detach.mockResolvedValue({ id: 'pm_1' });

      await provider.cancelMandate('pm_1');

      expect(paymentMethods.detach).toHaveBeenCalledWith(
        'pm_1',
        {},
        { stripeAccount: 'acct_club1' },
      );
    });

    it('tolerates an already-detached payment method', async () => {
      paymentMethods.detach.mockRejectedValue(
        invalidRequestError('A payment method may only be detached once'),
      );

      await expect(provider.cancelMandate('pm_1')).resolves.toBeUndefined();
    });

    it('rethrows a non-detachment failure', async () => {
      paymentMethods.detach.mockRejectedValue(new Error('network down'));

      await expect(provider.cancelMandate('pm_1')).rejects.toThrow('network down');
    });
  });
});

describe('StripeProviderFactory', () => {
  const makeFactory = (secretKey?: string) => {
    const configService = {
      get: jest.fn((key: string) => (key === 'STRIPE_SECRET_KEY' ? secretKey : undefined)),
    } as unknown as ConfigService;
    return new StripeProviderFactory(configService);
  };

  const connection: ProviderConnection = {
    clubId: 'club-1',
    provider: 'stripe',
    externalAccountId: 'acct_club1',
    livemode: true,
    source: 'connection',
  };

  it('is named stripe', () => {
    expect(makeFactory('sk_test_1').name).toBe('stripe');
  });

  it('is dormant when STRIPE_SECRET_KEY is unset', () => {
    // Every existing GoCardless club must be unaffected by Stripe being absent.
    const factory = makeFactory(undefined);
    expect(factory.isConfigured()).toBe(false);
  });

  it('is configured when the platform key is set', () => {
    expect(makeFactory('sk_test_1').isConfigured()).toBe(true);
  });

  it('builds a provider bound to the connection when configured', () => {
    const provider = makeFactory('sk_test_1').create(connection);
    expect(provider).toBeInstanceOf(StripeProvider);
    expect(provider.connection).toBe(connection);
  });

  it('throws rather than building a provider while unconfigured', () => {
    // The registry checks isConfigured() first, so reaching create() unconfigured
    // is a programming error, not a runtime config one.
    expect(() => makeFactory(undefined).create(connection)).toThrow();
  });
});
