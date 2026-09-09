import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { GoCardlessWebhookVerifier } from './gocardless.webhook-verifier';
import { WebhooksService } from './webhooks.service';
import { PaymentConnectionsService } from '../finance/payment-connections/payment-connections.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;

  // Verification runs before any club is known, so the controller injects the
  // verifier directly rather than resolving a club-bound provider.
  const mockVerifier = {
    verify: jest.fn(),
    parse: jest.fn(),
    accountRefOf: jest.fn(),
  };

  const mockWebhooksService = {
    handleEvent: jest.fn(),
  };

  const mockConnections = {
    findByExternalAccountId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: GoCardlessWebhookVerifier, useValue: mockVerifier },
        { provide: WebhooksService, useValue: mockWebhooksService },
        { provide: PaymentConnectionsService, useValue: mockConnections },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);

    jest.clearAllMocks();
    // Default: events name no connected account, i.e. Swimly's own legacy
    // account. Individual routing tests override this.
    mockVerifier.accountRefOf.mockReturnValue(null);
  });

  const createMockRequest = (body: any, rawBody?: string) => ({
    rawBody: rawBody ? Buffer.from(rawBody) : undefined,
    body,
  });

  const sampleEvents: Array<{
    id: string;
    resource_type: string;
    action: string;
    links: Record<string, string>;
  }> = [
    {
      id: 'EV001',
      resource_type: 'mandates',
      action: 'active',
      links: { mandate: 'MD000001' },
    },
    {
      id: 'EV002',
      resource_type: 'payments',
      action: 'confirmed',
      links: { payment: 'PM000001' },
    },
  ];

  describe('valid signature', () => {
    beforeEach(() => {
      mockVerifier.verify.mockReturnValue(true);
      mockVerifier.parse.mockReturnValue(sampleEvents);
      mockWebhooksService.handleEvent.mockResolvedValue(undefined);
    });

    it('should process all events and return received: true', async () => {
      const body = { events: sampleEvents };
      const rawBody = JSON.stringify(body);
      const request = createMockRequest(body, rawBody);

      const result = await controller.handleWebhook(request as any, 'valid-signature', body);

      expect(result).toEqual({ received: true });
      expect(mockWebhooksService.handleEvent).toHaveBeenCalledTimes(2);
      expect(mockWebhooksService.handleEvent).toHaveBeenCalledWith(sampleEvents[0], null);
      expect(mockWebhooksService.handleEvent).toHaveBeenCalledWith(sampleEvents[1], null);
    });

    it('should use raw body for signature verification when available', async () => {
      const body = { events: sampleEvents };
      const rawBody = '{"events":[]}';
      const request = createMockRequest(body, rawBody);

      await controller.handleWebhook(request as any, 'valid-signature', body);

      expect(mockVerifier.verify).toHaveBeenCalledWith(rawBody, 'valid-signature');
    });

    it('parses the same raw bytes that were verified', async () => {
      // Parsing anything other than the verified bytes would mean acting on
      // data the signature never covered.
      const body = { events: sampleEvents };
      const rawBody = '{"events":[]}';
      const request = createMockRequest(body, rawBody);

      await controller.handleWebhook(request as any, 'valid-signature', body);

      expect(mockVerifier.parse).toHaveBeenCalledWith(rawBody);
    });

    it('should fall back to stringified body when raw body is not available', async () => {
      const body = { events: sampleEvents };
      const request = createMockRequest(body);

      await controller.handleWebhook(request as any, 'valid-signature', body);

      expect(mockVerifier.verify).toHaveBeenCalledWith(JSON.stringify(body), 'valid-signature');
    });
  });

  describe('routing to a connected account', () => {
    beforeEach(() => {
      mockVerifier.verify.mockReturnValue(true);
      mockVerifier.parse.mockReturnValue([sampleEvents[0]]);
      mockWebhooksService.handleEvent.mockResolvedValue(undefined);
    });

    it('routes the event to the club that owns the connected account', async () => {
      mockVerifier.accountRefOf.mockReturnValue('OR123');
      mockConnections.findByExternalAccountId.mockResolvedValue({ club_id: 'club-abc' });

      const body = { events: [sampleEvents[0]] };
      await controller.handleWebhook(
        createMockRequest(body, JSON.stringify(body)) as any,
        'valid-signature',
        body,
      );

      expect(mockConnections.findByExternalAccountId).toHaveBeenCalledWith('gocardless', 'OR123');
      expect(mockWebhooksService.handleEvent).toHaveBeenCalledWith(sampleEvents[0], 'club-abc');
    });

    it('passes a null club for an event naming no account (Swimly legacy account)', async () => {
      // Swimly's own account serves every club, so it names none. The handler
      // falls back to the record's own club, as before.
      mockVerifier.accountRefOf.mockReturnValue(null);

      const body = { events: [sampleEvents[0]] };
      await controller.handleWebhook(
        createMockRequest(body, JSON.stringify(body)) as any,
        'valid-signature',
        body,
      );

      expect(mockConnections.findByExternalAccountId).not.toHaveBeenCalled();
      expect(mockWebhooksService.handleEvent).toHaveBeenCalledWith(sampleEvents[0], null);
    });

    it('ignores an event from an unknown connected account', async () => {
      mockVerifier.accountRefOf.mockReturnValue('OR_unknown');
      mockConnections.findByExternalAccountId.mockResolvedValue(null);

      const body = { events: [sampleEvents[0]] };
      const result = await controller.handleWebhook(
        createMockRequest(body, JSON.stringify(body)) as any,
        'valid-signature',
        body,
      );

      // Skipped, but still 200: GoCardless retries failures and eventually
      // disables an endpoint that keeps failing, so rejecting events for an
      // account we legitimately do not know would break webhooks for everyone.
      expect(mockWebhooksService.handleEvent).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('keeps processing later events after skipping an unknown account', async () => {
      mockVerifier.parse.mockReturnValue(sampleEvents);
      mockVerifier.accountRefOf.mockReturnValueOnce('OR_unknown').mockReturnValueOnce('OR123');
      mockConnections.findByExternalAccountId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ club_id: 'club-abc' });

      const body = { events: sampleEvents };
      await controller.handleWebhook(
        createMockRequest(body, JSON.stringify(body)) as any,
        'valid-signature',
        body,
      );

      expect(mockWebhooksService.handleEvent).toHaveBeenCalledTimes(1);
      expect(mockWebhooksService.handleEvent).toHaveBeenCalledWith(sampleEvents[1], 'club-abc');
    });
  });

  describe('invalid signature', () => {
    it('should throw BadRequestException when signature is invalid', async () => {
      mockVerifier.verify.mockReturnValue(false);

      const body = { events: sampleEvents };
      const request = createMockRequest(body, JSON.stringify(body));

      await expect(
        controller.handleWebhook(request as any, 'invalid-signature', body),
      ).rejects.toThrow(BadRequestException);

      expect(mockWebhooksService.handleEvent).not.toHaveBeenCalled();
    });

    it('does not even parse the body when the signature is invalid', async () => {
      mockVerifier.verify.mockReturnValue(false);

      const body = { events: sampleEvents };
      const request = createMockRequest(body, JSON.stringify(body));

      await expect(
        controller.handleWebhook(request as any, 'invalid-signature', body),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerifier.parse).not.toHaveBeenCalled();
    });
  });

  describe('error resilience', () => {
    it('should continue processing remaining events when one event fails', async () => {
      mockVerifier.verify.mockReturnValue(true);
      mockVerifier.parse.mockReturnValue(sampleEvents);

      // First event throws, second succeeds
      mockWebhooksService.handleEvent
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce(undefined);

      const body = { events: sampleEvents };
      const request = createMockRequest(body, JSON.stringify(body));

      const result = await controller.handleWebhook(request as any, 'valid-signature', body);

      expect(result).toEqual({ received: true });
      expect(mockWebhooksService.handleEvent).toHaveBeenCalledTimes(2);
    });

    it('should return received: true even when all events fail', async () => {
      mockVerifier.verify.mockReturnValue(true);
      mockVerifier.parse.mockReturnValue(sampleEvents);

      mockWebhooksService.handleEvent.mockRejectedValue(new Error('Processing failed'));

      const body = { events: sampleEvents };
      const request = createMockRequest(body, JSON.stringify(body));

      const result = await controller.handleWebhook(request as any, 'valid-signature', body);

      expect(result).toEqual({ received: true });
    });

    it('should handle empty events array', async () => {
      mockVerifier.verify.mockReturnValue(true);
      mockVerifier.parse.mockReturnValue([]);

      const body = { events: [] };
      const request = createMockRequest(body, JSON.stringify(body));

      const result = await controller.handleWebhook(request as any, 'valid-signature', body);

      expect(result).toEqual({ received: true });
      expect(mockWebhooksService.handleEvent).not.toHaveBeenCalled();
    });
  });
});
