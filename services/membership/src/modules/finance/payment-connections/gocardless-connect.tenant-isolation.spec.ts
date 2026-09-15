import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { GoCardlessClient } from 'gocardless-nodejs/client';
import { GoCardlessConnectService } from './gocardless-connect.service';
import { ClubPaymentConnection } from './entities/club-payment-connection.entity';

jest.mock('gocardless-nodejs/client', () => ({ GoCardlessClient: jest.fn() }));

// Run against a migrated, disposable local database; never inherit application credentials.
const connectionUrl = process.env.TEM55_TEST_DATABASE_URL;
const suite = connectionUrl ? describe : describe.skip;
suite('GoCardless PostgreSQL tenant isolation and concurrency', () => {
  let db: DataSource;
  let service: GoCardlessConnectService;
  const clubA = randomUUID();
  const clubB = randomUUID();
  const adminA = randomUUID();
  const adminB = randomUUID();
  const originalFetch = global.fetch;
  beforeAll(async () => {
    const url = new URL(connectionUrl!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/tumblebase_tem55')
      throw new Error('A disposable local tumblebase_tem55 database is required.');
    db = await new DataSource({
      type: 'postgres',
      url: connectionUrl,
      entities: [ClubPaymentConnection],
      synchronize: false,
    }).initialize();
    await db.query('INSERT INTO clubs (id,name,slug) VALUES ($1,$2,$3),($4,$5,$6)', [
      clubA,
      'TEM55 A',
      clubA,
      clubB,
      'TEM55 B',
      clubB,
    ]);
    service = new GoCardlessConnectService(
      new ConfigService({
        GOCARDLESS_CLIENT_ID: 'test-client',
        GOCARDLESS_CLIENT_SECRET: 'test-secret',
        APP_URL: 'https://app.example.test',
        GOCARDLESS_ENVIRONMENT: 'sandbox',
        PAYMENT_TOKEN_KEY_ID: 'v1',
        PAYMENT_TOKEN_KEYS: JSON.stringify({ v1: 'ab'.repeat(32) }),
      }),
      db,
    );
    (GoCardlessClient as jest.Mock).mockImplementation(() => ({
      creditors: { list: async () => ({ creditors: [{ verification_status: 'successful' }] }) },
    }));
  });
  afterAll(async () => {
    global.fetch = originalFetch;
    if (db?.isInitialized) {
      await db.query('DELETE FROM clubs WHERE id IN ($1,$2)', [clubA, clubB]);
      await db.destroy();
    }
  });
  it('rejects another club/admin without consuming the valid owner request, and only exchanges a raced code once', async () => {
    const { url } = await service.start(clubA, adminA);
    const state = new URL(url).searchParams.get('state')!;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'merchant-token',
        organisation_id: `OR${clubA.replace(/-/g, '')}`,
      }),
    });
    await expect(service.complete(clubB, adminB, 'code', state)).rejects.toThrow('expired');
    await expect(service.complete(clubA, adminB, 'code', state)).rejects.toThrow('expired');
    expect(global.fetch).not.toHaveBeenCalled();
    const results = await Promise.allSettled([
      service.complete(clubA, adminA, 'code', state),
      service.complete(clubA, adminA, 'code', state),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((await service.getStatus(clubA)).status).toBe('active');
    expect((await service.getStatus(clubB)).status).toBe('none');
  });
  it('does not allow another club to claim the same provider organisation', async () => {
    const { url } = await service.start(clubB, adminB);
    await expect(
      service.complete(clubB, adminB, 'code', new URL(url).searchParams.get('state')!),
    ).rejects.toThrow('already connected');
    expect((await service.getStatus(clubB)).status).toBe('none');
  });
  it('disconnecting another club cannot erase the first club credentials', async () => {
    await service.disconnect(clubB);
    expect((await service.getStatus(clubA)).status).toBe('active');
    await service.disconnect(clubA);
    const rows = await db.query(
      'SELECT access_token_encrypted FROM club_payment_connections WHERE club_id=$1',
      [clubA],
    );
    expect(rows[0].access_token_encrypted).toBeNull();
  });
});
