import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { GoCardlessWebhookVerifier } from './gocardless.webhook-verifier';
import { WebhooksService } from './webhooks.service';
import { PaymentConnectionsService } from '../finance/payment-connections/payment-connections.service';
import { PartnerWebhooksService } from './partner-webhooks.service';

describe('GoCardless partner webhook ingress', () => {
  const verifier = { verify: jest.fn(), parse: jest.fn(), accountRefOf: jest.fn() };
  const connections = { findByExternalAccountId: jest.fn() };
  const partner = { handle: jest.fn() };
  const event = {
    id: 'EV1',
    resource_type: 'payments',
    action: 'confirmed',
    links: { organisation: 'OR1', payment: 'PM1' },
  };
  const rawBody = Buffer.from(JSON.stringify({ events: [event] }));
  const controller = new WebhooksController(
    verifier as unknown as GoCardlessWebhookVerifier,
    {} as WebhooksService,
    connections as unknown as PaymentConnectionsService,
    partner as unknown as PartnerWebhooksService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    verifier.verify.mockReturnValue(true);
    verifier.parse.mockReturnValue([event]);
    verifier.accountRefOf.mockReturnValue('OR1');
    connections.findByExternalAccountId.mockResolvedValue({ club_id: 'club1' });
  });
  it('verifies exact raw bytes before routing to the account owner', async () => {
    await expect(controller.handleWebhook({ rawBody } as any, 'signature', {})).resolves.toEqual({
      received: true,
    });
    expect(verifier.verify).toHaveBeenCalledWith(rawBody.toString(), 'signature');
    expect(partner.handle).toHaveBeenCalledWith(event, 'club1');
  });
  it('rejects missing raw bytes and invalid signatures before parsing', async () => {
    await expect(controller.handleWebhook({} as any, 'signature', {})).rejects.toThrow(
      BadRequestException,
    );
    verifier.verify.mockReturnValue(false);
    await expect(controller.handleWebhook({ rawBody } as any, 'signature', {})).rejects.toThrow(
      BadRequestException,
    );
    expect(verifier.parse).not.toHaveBeenCalled();
  });
  it('ignores unsigned ownership assumptions and unknown organisations', async () => {
    verifier.accountRefOf.mockReturnValue(null);
    await controller.handleWebhook({ rawBody } as any, 'signature', {});
    verifier.accountRefOf.mockReturnValue('OR2');
    connections.findByExternalAccountId.mockResolvedValue(null);
    await controller.handleWebhook({ rawBody } as any, 'signature', {});
    expect(partner.handle).not.toHaveBeenCalled();
  });
  it('processes the rest of the batch but asks the provider to retry failures', async () => {
    verifier.parse.mockReturnValue([event, { ...event, id: 'EV2' }]);
    partner.handle.mockRejectedValueOnce(new Error('failure')).mockResolvedValueOnce(undefined);
    await expect(controller.handleWebhook({ rawBody } as any, 'signature', {})).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(partner.handle).toHaveBeenCalledTimes(2);
  });
});
