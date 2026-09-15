import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { GoCardlessClient } from 'gocardless-nodejs/client';
import { PartnerWebhooksService } from './partner-webhooks.service';
import { WebhooksService } from './webhooks.service';
import {
  PaymentTokenCipher,
  paymentTokenContext,
} from '../finance/payment-connections/payment-token-cipher';

jest.mock('gocardless-nodejs/client', () => ({ GoCardlessClient: jest.fn() }));

describe('Partner webhook isolation and retries', () => {
  const config = new ConfigService({
    PAYMENT_TOKEN_KEY_ID: 'v1',
    PAYMENT_TOKEN_KEYS: JSON.stringify({ v1: 'ab'.repeat(32) }),
  });
  const manager = { query: jest.fn(), findOneBy: jest.fn(), save: jest.fn() };
  const handler = { handleEvent: jest.fn() };
  const client = {
    creditors: { list: jest.fn() },
    payments: { find: jest.fn() },
    mandates: { find: jest.fn() },
  };
  const event = {
    id: 'EV1',
    resource_type: 'payments',
    action: 'submitted',
    links: { organisation: 'OR1', payment: 'PM1' },
  };
  let service: PartnerWebhooksService;
  let owner: string | null;
  let received: boolean;
  beforeEach(() => {
    jest.clearAllMocks();
    owner = 'club1';
    received = false;
    const row = { club_id: 'club1', external_account_id: 'OR1', livemode: false, status: 'active' };
    const encrypted = new PaymentTokenCipher(config).encrypt(
      'club-token',
      paymentTokenContext(row),
    );
    manager.findOneBy.mockResolvedValue({
      ...row,
      access_token_encrypted: encrypted.encrypted,
      encryption_key_id: encrypted.keyId,
    });
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT event_id')) return received ? [{ event_id: 'EV1' }] : [];
      if (sql.startsWith('SELECT club_id')) return owner ? [{ club_id: owner }] : [];
      if (sql.startsWith('INSERT')) received = true;
      return [];
    });
    client.creditors.list.mockResolvedValue({ creditors: [{}] });
    client.payments.find.mockResolvedValue({ status: 'confirmed' });
    (GoCardlessClient as jest.Mock).mockReturnValue(client);
    service = new PartnerWebhooksService(
      { transaction: async (work: (m: unknown) => unknown) => work(manager) } as DataSource,
      config,
      handler as unknown as WebhooksService,
    );
  });
  it('applies current provider state, then durably ignores a duplicate', async () => {
    await service.handle(event, 'club1');
    await service.handle(event, 'club1');
    expect(handler.handleEvent).toHaveBeenCalledTimes(1);
    expect(handler.handleEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'confirmed' }),
      'club1',
    );
    expect(GoCardlessClient).toHaveBeenCalledWith('club-token', expect.anything());
  });
  it('never updates a resource owned by another club', async () => {
    owner = 'club2';
    await service.handle(event, 'club1');
    expect(handler.handleEvent).not.toHaveBeenCalled();
    expect(client.payments.find).not.toHaveBeenCalled();
  });
  it('retries a local creation race but acknowledges old unrelated dashboard activity', async () => {
    owner = null;
    await expect(
      service.handle({ ...event, created_at: new Date().toISOString() }, 'club1'),
    ).rejects.toThrow('not available yet');
    await service.handle({ ...event, created_at: '2020-01-01T00:00:00Z' }, 'club1');
    expect(handler.handleEvent).not.toHaveBeenCalled();
  });
  it('does not record transient provider failures, allowing retry', async () => {
    client.payments.find.mockRejectedValueOnce(new Error('secret provider response'));
    await expect(service.handle(event, 'club1')).rejects.toThrow(
      'Could not read current payment state.',
    );
    expect(received).toBe(false);
    await service.handle(event, 'club1');
    expect(handler.handleEvent).toHaveBeenCalledTimes(1);
  });
  it('ignores stale disconnection after reconnect but clears a revoked token', async () => {
    const disconnected = { ...event, resource_type: 'organisations', action: 'disconnected' };
    await service.handle(disconnected, 'club1');
    expect(manager.save).not.toHaveBeenCalled();
    client.creditors.list.mockRejectedValueOnce({ code: '401' });
    await service.handle(disconnected, 'club1');
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'disconnected',
        access_token_encrypted: null,
        encryption_key_id: null,
      }),
    );
  });
});
