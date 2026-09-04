import { NotImplementedException } from '@nestjs/common';
import { GoCardlessProvider, GoCardlessProviderFactory } from './gocardless.provider';
import { GoCardlessService } from '../../gocardless/gocardless.service';
import { ProviderConnection } from './payment-provider.interface';

describe('GoCardlessProvider', () => {
  let provider: GoCardlessProvider;

  const mockGoCardlessService = {
    isConfigured: jest.fn(),
    createRedirectFlow: jest.fn(),
    completeRedirectFlow: jest.fn(),
    getMandate: jest.fn(),
    cancelMandate: jest.fn(),
    createPayment: jest.fn(),
  };

  // The legacy env shim: a club still transacting on Swimly's own account.
  const envConnection: ProviderConnection = {
    clubId: 'club-1',
    provider: 'gocardless',
    externalAccountId: 'swimly-legacy-env',
    livemode: false,
    source: 'env',
    accessToken: 'sandbox_token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Constructed directly rather than through DI: a bound provider is only
    // meaningful with a connection, so it is not injectable.
    provider = new GoCardlessProvider(
      envConnection,
      mockGoCardlessService as unknown as GoCardlessService,
    );
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('exposes the connection it is bound to', () => {
    expect(provider.connection).toBe(envConnection);
  });

  describe('startMandateSetup', () => {
    it('delegates to createRedirectFlow and maps the result', async () => {
      mockGoCardlessService.createRedirectFlow.mockResolvedValue({
        id: 'RE123',
        redirect_url: 'https://pay.gocardless.com/flow/RE123',
      });

      const result = await provider.startMandateSetup({
        sessionToken: 'sess-1',
        successRedirectUrl: 'https://app/return',
        description: 'Set up Direct Debit',
      });

      expect(mockGoCardlessService.createRedirectFlow).toHaveBeenCalledWith({
        sessionToken: 'sess-1',
        successRedirectUrl: 'https://app/return',
        description: 'Set up Direct Debit',
      });
      expect(result).toEqual({
        flowId: 'RE123',
        redirectUrl: 'https://pay.gocardless.com/flow/RE123',
      });
    });

    it('passes the bank-debit scheme through unchanged', async () => {
      // The AU/BECS path depends on this reaching GoCardless.
      mockGoCardlessService.createRedirectFlow.mockResolvedValue({ id: 'RE1', redirect_url: 'u' });

      await provider.startMandateSetup({
        sessionToken: 'sess-1',
        successRedirectUrl: 'https://app/return',
        scheme: 'becs',
      });

      expect(mockGoCardlessService.createRedirectFlow).toHaveBeenCalledWith(
        expect.objectContaining({ scheme: 'becs' }),
      );
    });
  });

  describe('completeMandateSetup', () => {
    it('delegates to completeRedirectFlow and maps the linked ids', async () => {
      mockGoCardlessService.completeRedirectFlow.mockResolvedValue({
        links: { mandate: 'MD777', customer: 'CU777' },
      });

      const result = await provider.completeMandateSetup({
        flowId: 'RE123',
        sessionToken: 'sess-1',
      });

      expect(mockGoCardlessService.completeRedirectFlow).toHaveBeenCalledWith('RE123', 'sess-1');
      expect(result).toEqual({
        providerMandateId: 'MD777',
        providerCustomerId: 'CU777',
      });
    });

    it('coalesces missing links to empty strings (preserving prior semantics)', async () => {
      mockGoCardlessService.completeRedirectFlow.mockResolvedValue({ links: {} });

      const result = await provider.completeMandateSetup({
        flowId: 'RE123',
        sessionToken: 'sess-1',
      });

      expect(result).toEqual({ providerMandateId: '', providerCustomerId: '' });
    });
  });

  describe('getMandateStatus', () => {
    it('delegates to getMandate and returns the raw status string', async () => {
      mockGoCardlessService.getMandate.mockResolvedValue({ status: 'active' });

      const status = await provider.getMandateStatus('MD777');

      expect(mockGoCardlessService.getMandate).toHaveBeenCalledWith('MD777');
      expect(status).toBe('active');
    });
  });

  describe('cancelMandate', () => {
    it('delegates to cancelMandate with the same id', async () => {
      mockGoCardlessService.cancelMandate.mockResolvedValue(undefined);

      await provider.cancelMandate('MD777');

      expect(mockGoCardlessService.cancelMandate).toHaveBeenCalledWith('MD777');
    });
  });

  describe('chargeRecurring', () => {
    it('delegates to createPayment with mapped args and returns the payment id', async () => {
      mockGoCardlessService.createPayment.mockResolvedValue({ id: 'PM999' });

      const result = await provider.chargeRecurring({
        amount: 42.5,
        currency: 'GBP',
        providerMandateId: 'MD777',
        description: 'Payment for invoice INV-1',
        metadata: { invoice_id: 'inv-1' },
      });

      expect(mockGoCardlessService.createPayment).toHaveBeenCalledWith({
        amount: 42.5,
        currency: 'GBP',
        mandateId: 'MD777',
        description: 'Payment for invoice INV-1',
        metadata: { invoice_id: 'inv-1' },
        idempotencyKey: undefined,
      });
      expect(result).toEqual({ providerPaymentId: 'PM999' });
    });

    it('forwards the idempotency key so a retry cannot double-charge', async () => {
      mockGoCardlessService.createPayment.mockResolvedValue({ id: 'PM999' });

      await provider.chargeRecurring({
        amount: 10,
        currency: 'GBP',
        providerMandateId: 'MD777',
        idempotencyKey: 'invoice-inv-1',
      });

      expect(mockGoCardlessService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'invoice-inv-1' }),
      );
    });

    it('ignores providerCustomerId, which GoCardless does not need', async () => {
      // GoCardless charges the mandate directly. The field exists for Stripe,
      // which has no chargeable mandate.
      mockGoCardlessService.createPayment.mockResolvedValue({ id: 'PM999' });

      await provider.chargeRecurring({
        amount: 10,
        currency: 'GBP',
        providerMandateId: 'MD777',
        providerCustomerId: 'CU777',
      });

      expect(mockGoCardlessService.createPayment).toHaveBeenCalledWith(
        expect.not.objectContaining({ providerCustomerId: expect.anything() }),
      );
    });
  });
});

describe('GoCardlessProviderFactory', () => {
  let factory: GoCardlessProviderFactory;

  const mockGoCardlessService = {
    isConfigured: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    factory = new GoCardlessProviderFactory(mockGoCardlessService as unknown as GoCardlessService);
  });

  it('is named gocardless', () => {
    expect(factory.name).toBe('gocardless');
  });

  it('reports platform configuration from GoCardlessService', () => {
    mockGoCardlessService.isConfigured.mockReturnValue(true);

    expect(factory.isConfigured()).toBe(true);
    expect(mockGoCardlessService.isConfigured).toHaveBeenCalledTimes(1);
  });

  it('builds a provider bound to a legacy env connection', () => {
    const connection: ProviderConnection = {
      clubId: 'club-1',
      provider: 'gocardless',
      externalAccountId: 'swimly-legacy-env',
      livemode: false,
      source: 'env',
    };

    const provider = factory.create(connection);

    expect(provider).toBeInstanceOf(GoCardlessProvider);
    expect(provider.connection).toBe(connection);
  });

  it('refuses a real connected account until Partner OAuth is wired', () => {
    // The singleton client holds Swimly's own credentials. Building a provider
    // from it for a club that connected its OWN GoCardless account would bill
    // through Swimly's account instead of theirs, which is the exact bug this
    // refactor removes. Fail loudly rather than silently.
    const connection: ProviderConnection = {
      clubId: 'club-1',
      provider: 'gocardless',
      externalAccountId: 'OR123',
      livemode: true,
      source: 'connection',
    };

    expect(() => factory.create(connection)).toThrow(NotImplementedException);
  });
});
