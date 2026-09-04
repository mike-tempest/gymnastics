import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { StripeWebhooksController } from './stripe-webhooks.controller';
import { StripeWebhookVerifier } from './stripe.webhook-verifier';
import { WebhooksService } from './webhooks.service';
import { PaymentConnectionsService } from '../finance/payment-connections/payment-connections.service';
import { StripeConnectService } from '../finance/payment-connections/stripe-connect.service';

describe('StripeWebhooksController', () => {
  let controller: StripeWebhooksController;

  const mockVerifier = {
    verify: jest.fn(),
    parse: jest.fn(),
    accountRefOf: jest.fn(),
  };
  const mockWebhooksService = { handleEvent: jest.fn() };
  const mockConnections = { findByExternalAccountId: jest.fn() };
  const mockStripeConnect = { syncByAccountId: jest.fn() };

  const event = {
    id: 'evt_1',
    resource_type: 'payments',
    action: 'confirmed',
    links: { payment: 'pi_1', account: 'acct_club1' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhooksController],
      providers: [
        { provide: StripeWebhookVerifier, useValue: mockVerifier },
        { provide: WebhooksService, useValue: mockWebhooksService },
        { provide: PaymentConnectionsService, useValue: mockConnections },
        { provide: StripeConnectService, useValue: mockStripeConnect },
      ],
    }).compile();

    controller = module.get(StripeWebhooksController);
    jest.clearAllMocks();
    mockVerifier.verify.mockReturnValue(true);
    mockVerifier.parse.mockReturnValue([event]);
    mockVerifier.accountRefOf.mockReturnValue('acct_club1');
    mockWebhooksService.handleEvent.mockResolvedValue(undefined);
    mockStripeConnect.syncByAccountId.mockResolvedValue(undefined);
  });

  const req = (raw: string) => ({ rawBody: Buffer.from(raw) }) as never;

  it('rejects an invalid signature and processes nothing', async () => {
    mockVerifier.verify.mockReturnValue(false);

    await expect(controller.handleWebhook(req('{}'), 'bad-sig', {})).rejects.toThrow(
      BadRequestException,
    );
    expect(mockWebhooksService.handleEvent).not.toHaveBeenCalled();
  });

  it('routes a verified event to its club and tags the provider as stripe', async () => {
    mockConnections.findByExternalAccountId.mockResolvedValue({ club_id: 'club-abc' });

    const result = await controller.handleWebhook(req('{}'), 'good-sig', {});

    expect(mockConnections.findByExternalAccountId).toHaveBeenCalledWith('stripe', 'acct_club1');
    // The 'stripe' argument is what makes the handler look up stripe records
    // rather than gocardless ones.
    expect(mockWebhooksService.handleEvent).toHaveBeenCalledWith(event, 'club-abc', 'stripe');
    expect(result).toEqual({ received: true });
  });

  it('ignores a platform event that names no connected account', async () => {
    // Stripe has no legacy shared account, so an unrouted event is nobody's club.
    mockVerifier.accountRefOf.mockReturnValue(null);

    const result = await controller.handleWebhook(req('{}'), 'good-sig', {});

    expect(mockConnections.findByExternalAccountId).not.toHaveBeenCalled();
    expect(mockWebhooksService.handleEvent).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });

  it('ignores an event from an unknown connected account but still answers 200', async () => {
    mockConnections.findByExternalAccountId.mockResolvedValue(null);

    const result = await controller.handleWebhook(req('{}'), 'good-sig', {});

    expect(mockWebhooksService.handleEvent).not.toHaveBeenCalled();
    // 200, not an error: Stripe disables an endpoint that keeps failing.
    expect(result).toEqual({ received: true });
  });

  it('routes account.updated to the connection sync, not the billing handler', async () => {
    const accountEvent = {
      id: 'evt_acct',
      resource_type: 'connections',
      action: 'updated',
      links: { account: 'acct_club1' },
    };
    mockVerifier.parse.mockReturnValue([accountEvent]);

    const result = await controller.handleWebhook(req('{}'), 'good-sig', {});

    // Same sync logic as the admin /sync endpoint, driven by the webhook.
    expect(mockStripeConnect.syncByAccountId).toHaveBeenCalledWith('acct_club1');
    expect(mockWebhooksService.handleEvent).not.toHaveBeenCalled();
    expect(mockConnections.findByExternalAccountId).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });

  it('answers 200 even when the connection sync fails', async () => {
    mockVerifier.parse.mockReturnValue([
      { id: 'evt_acct', resource_type: 'connections', action: 'updated', links: { account: 'acct_club1' } },
    ]);
    mockStripeConnect.syncByAccountId.mockRejectedValue(new Error('stripe down'));

    const result = await controller.handleWebhook(req('{}'), 'good-sig', {});

    expect(result).toEqual({ received: true });
  });

  it('keeps processing later events after one throws', async () => {
    const event2 = { ...event, id: 'evt_2', links: { payment: 'pi_2', account: 'acct_club1' } };
    mockVerifier.parse.mockReturnValue([event, event2]);
    mockConnections.findByExternalAccountId.mockResolvedValue({ club_id: 'club-abc' });
    mockWebhooksService.handleEvent
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    const result = await controller.handleWebhook(req('{}'), 'good-sig', {});

    expect(mockWebhooksService.handleEvent).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ received: true });
  });
});
