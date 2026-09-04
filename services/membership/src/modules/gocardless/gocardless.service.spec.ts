import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { GoCardlessService } from './gocardless.service';

// Mock the gocardless-nodejs client module
jest.mock('gocardless-nodejs/client', () => ({
  GoCardlessClient: jest.fn().mockImplementation(() => ({
    redirectFlows: {
      create: jest.fn(),
      complete: jest.fn(),
    },
    customers: {
      find: jest.fn(),
    },
    mandates: {
      find: jest.fn(),
      cancel: jest.fn(),
    },
    payments: {
      create: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
    },
  })),
}));

jest.mock('gocardless-nodejs/constants', () => ({
  Environments: {
    Live: 'live',
    Sandbox: 'sandbox',
  },
}));

describe('GoCardlessService', () => {
  let service: GoCardlessService;
  let mockClient: any;

  const mockConfig: Record<string, string> = {
    GOCARDLESS_ACCESS_TOKEN: 'test-access-token',
    GOCARDLESS_ENVIRONMENT: 'sandbox',
    GOCARDLESS_WEBHOOK_SECRET: 'test-webhook-secret',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoCardlessService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              return mockConfig[key] ?? defaultValue ?? undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GoCardlessService>(GoCardlessService);

    // Access the private client for mock setup
    mockClient = (service as any).client;
  });

  describe('isConfigured', () => {
    it('should return true when access token is present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when access token is missing', async () => {
      const emptyConfig: Record<string, string | undefined> = {
        GOCARDLESS_ACCESS_TOKEN: undefined,
        GOCARDLESS_ENVIRONMENT: 'sandbox',
        GOCARDLESS_WEBHOOK_SECRET: undefined,
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GoCardlessService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                return emptyConfig[key] ?? defaultValue ?? undefined;
              }),
            },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<GoCardlessService>(GoCardlessService);
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('createRedirectFlow', () => {
    it('should create a redirect flow with correct parameters', async () => {
      const mockResponse = {
        id: 'RE000001',
        redirect_url: 'https://pay.gocardless.com/flow/static/auth',
      };
      mockClient.redirectFlows.create.mockResolvedValue(mockResponse);

      const result = await service.createRedirectFlow({
        sessionToken: 'session-123',
        successRedirectUrl: 'https://app.swimly.uk/mandate/success',
        description: 'Monthly swim club fees',
      });

      expect(mockClient.redirectFlows.create).toHaveBeenCalledWith({
        session_token: 'session-123',
        success_redirect_url: 'https://app.swimly.uk/mandate/success',
        description: 'Monthly swim club fees',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should use default description when none is provided', async () => {
      mockClient.redirectFlows.create.mockResolvedValue({ id: 'RE000002' });

      await service.createRedirectFlow({
        sessionToken: 'session-456',
        successRedirectUrl: 'https://app.swimly.uk/mandate/success',
      });

      expect(mockClient.redirectFlows.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Set up Direct Debit for swim club fees',
        }),
      );
    });

    it('should pass the scheme to GoCardless when one is supplied', async () => {
      mockClient.redirectFlows.create.mockResolvedValue({ id: 'RE000003' });

      await service.createRedirectFlow({
        sessionToken: 'session-789',
        successRedirectUrl: 'https://app.swimly.uk/mandate/success',
        scheme: 'ach',
      });

      expect(mockClient.redirectFlows.create).toHaveBeenCalledWith(
        expect.objectContaining({ scheme: 'ach' }),
      );
    });

    it('should omit the scheme when none is supplied', async () => {
      mockClient.redirectFlows.create.mockResolvedValue({ id: 'RE000004' });

      await service.createRedirectFlow({
        sessionToken: 'session-000',
        successRedirectUrl: 'https://app.swimly.uk/mandate/success',
      });

      const callArg = mockClient.redirectFlows.create.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('scheme');
    });

    it('should throw BadRequestException on failure', async () => {
      mockClient.redirectFlows.create.mockRejectedValue(new Error('API error'));

      await expect(
        service.createRedirectFlow({
          sessionToken: 'session-789',
          successRedirectUrl: 'https://app.swimly.uk/mandate/success',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeRedirectFlow', () => {
    it('should complete a redirect flow with the correct parameters', async () => {
      const mockResponse = {
        id: 'RE000001',
        links: { mandate: 'MD000001', customer: 'CU000001' },
      };
      mockClient.redirectFlows.complete.mockResolvedValue(mockResponse);

      const result = await service.completeRedirectFlow('RE000001', 'session-123');

      expect(mockClient.redirectFlows.complete).toHaveBeenCalledWith('RE000001', {
        session_token: 'session-123',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException on failure', async () => {
      mockClient.redirectFlows.complete.mockRejectedValue(new Error('Invalid flow'));

      await expect(service.completeRedirectFlow('RE000001', 'session-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createPayment', () => {
    it('should convert pounds to pence when creating a payment', async () => {
      const mockResponse = { id: 'PM000001', amount: '2550', currency: 'GBP' };
      mockClient.payments.create.mockResolvedValue(mockResponse);

      await service.createPayment({
        amount: 25.5,
        currency: 'GBP',
        mandateId: 'MD000001',
        description: 'Monthly fee',
      });

      // The second argument is the idempotency key, which the SDK takes
      // positionally after the request body.
      expect(mockClient.payments.create).toHaveBeenCalledWith(
        {
          amount: '2550',
          currency: 'GBP',
          links: { mandate: 'MD000001' },
          description: 'Monthly fee',
          metadata: undefined,
        },
        undefined,
      );
    });

    it('should handle whole pound amounts correctly', async () => {
      mockClient.payments.create.mockResolvedValue({ id: 'PM000002' });

      await service.createPayment({
        amount: 30,
        currency: 'GBP',
        mandateId: 'MD000001',
      });

      expect(mockClient.payments.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '3000' }),
        undefined,
      );
    });

    it('should round fractional pence correctly', async () => {
      mockClient.payments.create.mockResolvedValue({ id: 'PM000003' });

      await service.createPayment({
        amount: 19.999,
        currency: 'GBP',
        mandateId: 'MD000001',
      });

      // 19.999 * 100 = 1999.9, rounded = 2000
      expect(mockClient.payments.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '2000' }),
        undefined,
      );
    });

    it('should include metadata when provided', async () => {
      mockClient.payments.create.mockResolvedValue({ id: 'PM000004' });

      await service.createPayment({
        amount: 10,
        currency: 'GBP',
        mandateId: 'MD000001',
        metadata: { invoice_id: 'INV-001' },
      });

      expect(mockClient.payments.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { invoice_id: 'INV-001' } }),
        undefined,
      );
    });

    it('passes the idempotency key to the SDK so a retry cannot double-charge', async () => {
      mockClient.payments.create.mockResolvedValue({ id: 'PM000005' });

      await service.createPayment({
        amount: 10,
        currency: 'GBP',
        mandateId: 'MD000001',
        idempotencyKey: 'invoice-inv-1-2026-07',
      });

      expect(mockClient.payments.create).toHaveBeenCalledWith(
        expect.any(Object),
        'invoice-inv-1-2026-07',
      );
    });

    it('should throw BadRequestException on failure', async () => {
      mockClient.payments.create.mockRejectedValue(new Error('Mandate inactive'));

      await expect(
        service.createPayment({
          amount: 25.5,
          currency: 'GBP',
          mandateId: 'MD000001',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for a valid signature', () => {
      const body = '{"events":[]}';
      const expectedSignature = createHmac('sha256', 'test-webhook-secret')
        .update(body)
        .digest('hex');

      expect(service.verifyWebhookSignature(body, expectedSignature)).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const body = '{"events":[]}';
      expect(service.verifyWebhookSignature(body, 'invalid-signature')).toBe(false);
    });

    it('should return false for a tampered body', () => {
      const originalBody = '{"events":[]}';
      const signature = createHmac('sha256', 'test-webhook-secret')
        .update(originalBody)
        .digest('hex');

      const tamperedBody = '{"events":[{"id":"EV001"}]}';
      expect(service.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
    });
  });

  describe('parseWebhookEvent', () => {
    it('should return events from request body', () => {
      const events = [
        { id: 'EV001', resource_type: 'mandates', action: 'created', links: { mandate: 'MD001' } },
      ];
      expect(service.parseWebhookEvent({ events })).toEqual(events);
    });

    it('should return an empty array when no events are present', () => {
      expect(service.parseWebhookEvent({})).toEqual([]);
    });
  });

  describe('getCustomer', () => {
    it('should find a customer by ID', async () => {
      const mockCustomer = { id: 'CU000001', email: 'test@example.com' };
      mockClient.customers.find.mockResolvedValue(mockCustomer);

      const result = await service.getCustomer('CU000001');
      expect(mockClient.customers.find).toHaveBeenCalledWith('CU000001');
      expect(result).toEqual(mockCustomer);
    });

    it('should rethrow errors from the API', async () => {
      mockClient.customers.find.mockRejectedValue(new Error('Not found'));
      await expect(service.getCustomer('CU000001')).rejects.toThrow('Not found');
    });
  });

  describe('getMandate', () => {
    it('should find a mandate by ID', async () => {
      const mockMandate = { id: 'MD000001', status: 'active' };
      mockClient.mandates.find.mockResolvedValue(mockMandate);

      const result = await service.getMandate('MD000001');
      expect(mockClient.mandates.find).toHaveBeenCalledWith('MD000001');
      expect(result).toEqual(mockMandate);
    });
  });

  describe('cancelMandate', () => {
    it('should cancel a mandate', async () => {
      const mockResponse = { id: 'MD000001', status: 'cancelled' };
      mockClient.mandates.cancel.mockResolvedValue(mockResponse);

      const result = await service.cancelMandate('MD000001');
      expect(mockClient.mandates.cancel).toHaveBeenCalledWith('MD000001', {});
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException on failure', async () => {
      mockClient.mandates.cancel.mockRejectedValue(new Error('Already cancelled'));
      await expect(service.cancelMandate('MD000001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('listPayments', () => {
    it('should list payments filtered by mandate ID', async () => {
      const mockResponse = { payments: [], meta: {} };
      mockClient.payments.list.mockResolvedValue(mockResponse);

      await service.listPayments('MD000001');
      expect(mockClient.payments.list).toHaveBeenCalledWith({ mandate: 'MD000001' });
    });

    it('should list all payments when no mandate ID is provided', async () => {
      const mockResponse = { payments: [], meta: {} };
      mockClient.payments.list.mockResolvedValue(mockResponse);

      await service.listPayments();
      expect(mockClient.payments.list).toHaveBeenCalledWith({});
    });
  });
});
