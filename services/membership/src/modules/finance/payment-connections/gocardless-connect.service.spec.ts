import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { GoCardlessClient } from 'gocardless-nodejs/client';
import { GoCardlessConnectService } from './gocardless-connect.service';
import {
  ClubPaymentConnection,
  PaymentConnectionStatus as Status,
} from './entities/club-payment-connection.entity';

jest.mock('gocardless-nodejs/client', () => ({ GoCardlessClient: jest.fn() }));

describe('GoCardless account authorisation', () => {
  const config = new ConfigService({
    GOCARDLESS_CLIENT_ID: 'client',
    GOCARDLESS_CLIENT_SECRET: 'secret',
    PAYMENT_TOKEN_KEY_ID: 'v1',
    PAYMENT_TOKEN_KEYS: JSON.stringify({ v1: 'ab'.repeat(32) }),
    APP_URL: 'https://app.example.test',
    GOCARDLESS_ENVIRONMENT: 'sandbox',
  });
  let service: GoCardlessConnectService;
  let rows: Partial<ClubPaymentConnection>[];
  const manager = {
    query: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const db = { transaction: jest.fn(), query: jest.fn(), getRepository: jest.fn() };
  const creditors = { list: jest.fn() };
  const originalFetch = global.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [];
    manager.find.mockImplementation(async () => rows);
    manager.findOneBy.mockImplementation(async () => rows[0] ?? null);
    manager.create.mockImplementation((_type, row) => row);
    manager.save.mockImplementation(async (row) => {
      rows = [row];
      return row;
    });
    manager.query.mockResolvedValue([]);
    db.transaction.mockImplementation((work) => work(manager));
    db.query.mockResolvedValue([[{ state_hash: 'hash' }], 1]);
    db.getRepository.mockReturnValue(manager);
    creditors.list.mockResolvedValue({
      creditors: [{ id: 'CR1', verification_status: 'successful' }],
    });
    (GoCardlessClient as jest.Mock).mockImplementation(() => ({ creditors }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'merchant-token', organisation_id: 'OR1' }),
    });
    service = new GoCardlessConnectService(config, db as unknown as DataSource);
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it('generates single-use state bound to admin, club, mode and callback without exposing secrets', async () => {
    const { url } = await service.start('club1', 'admin1');
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://connect-sandbox.gocardless.com');
    expect(parsed.searchParams.get('scope')).toBe('read_write');
    expect(url).not.toContain('secret');
    expect(parsed.searchParams.get('state')).toMatch(/^[a-f0-9]{64}$/);
    expect(manager.query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT'), [
      expect.any(String),
      'club1',
      'admin1',
      false,
      'https://app.example.test/admin/settings',
    ]);
  });
  it('rejects expired/replayed state before exchanging a code', async () => {
    db.query.mockResolvedValue([[], 0]);
    await expect(service.complete('club1', 'admin1', 'code', 'state')).rejects.toThrow('expired');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('consumes state with the authenticated club and admin rather than browser-supplied ownership', async () => {
    await service.complete('club1', 'admin1', 'code', 'state');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('user_id=$3'), [
      expect.any(String),
      'club1',
      'admin1',
      false,
      'https://app.example.test/admin/settings',
    ]);
    expect(rows[0].access_token_encrypted).not.toContain('merchant-token');
    expect(await service.getStatus('club1')).not.toHaveProperty('access_token_encrypted');
  });
  it('keeps verification-incomplete accounts pending', async () => {
    creditors.list.mockResolvedValue({ creditors: [{ verification_status: 'action_required' }] });
    expect((await service.complete('club1', 'admin1', 'code', 'state')).status).toBe('pending');
  });
  it('refuses a different organisation on reconnect', async () => {
    rows = [{ provider: 'gocardless', external_account_id: 'OR_OTHER', livemode: false }];
    await expect(service.complete('club1', 'admin1', 'code', 'state')).rejects.toThrow(
      'same GoCardless',
    );
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('does not overwrite another payment provider', async () => {
    rows = [{ provider: 'stripe', status: Status.ACTIVE }];
    await expect(service.start('club1', 'admin1')).rejects.toThrow('existing payment connection');
  });
  it('sanitises token exchange failures', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Authorization: secret'));
    await expect(service.complete('club1', 'admin1', 'code', 'state')).rejects.toThrow(
      'authorisation could not',
    );
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('disconnect clears credentials and outstanding state without deleting payment history', async () => {
    await service.disconnect('club1');
    expect(manager.update).toHaveBeenCalledWith(
      ClubPaymentConnection,
      { club_id: 'club1', provider: 'gocardless' },
      expect.objectContaining({ status: Status.DISCONNECTED, access_token_encrypted: null }),
    );
    expect(manager.query).toHaveBeenLastCalledWith(
      expect.stringContaining('DELETE FROM payment_oauth_states'),
      ['club1'],
    );
  });
});
