import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LEGACY_ENV_ACCOUNT_REF, PaymentConnectionsService } from './payment-connections.service';
import {
  ClubPaymentConnection,
  PaymentConnectionStatus,
} from './entities/club-payment-connection.entity';
import { ProviderNotConnectedException } from './provider-not-connected.exception';

describe('PaymentConnectionsService', () => {
  const CLUB_ID = '999e0000-e89b-12d3-a456-426614174099';

  let service: PaymentConnectionsService;

  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const configValues: Record<string, string | undefined> = {};
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const activeRow: Partial<ClubPaymentConnection> = {
    club_id: CLUB_ID,
    provider: 'stripe',
    external_account_id: 'acct_123',
    status: PaymentConnectionStatus.ACTIVE,
    livemode: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: no legacy env credentials and no fallback flag, so the shim is
    // off unless a test explicitly turns it on.
    delete configValues.GOCARDLESS_ACCESS_TOKEN;
    delete configValues.GOCARDLESS_ENVIRONMENT;
    delete configValues.LEGACY_GOCARDLESS_ENV_FALLBACK;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentConnectionsService,
        { provide: getRepositoryToken(ClubPaymentConnection), useValue: repo },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PaymentConnectionsService>(PaymentConnectionsService);
  });

  describe('requireActiveConnection', () => {
    it("returns the club's active connection", async () => {
      repo.findOne.mockResolvedValue(activeRow);

      const connection = await service.requireActiveConnection(CLUB_ID);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { club_id: CLUB_ID, status: PaymentConnectionStatus.ACTIVE },
      });
      expect(connection).toEqual({
        clubId: CLUB_ID,
        provider: 'stripe',
        externalAccountId: 'acct_123',
        livemode: true,
        source: 'connection',
        accessToken: undefined,
      });
    });

    it('throws when the club has no connection at all', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.requireActiveConnection(CLUB_ID)).rejects.toThrow(
        ProviderNotConnectedException,
      );
    });

    it('reports WHY when a connection exists but is not active', async () => {
      // "Finish your onboarding" and "you never started" need different actions
      // from the club, so the reason is carried rather than flattened.
      repo.findOne
        .mockResolvedValueOnce(null) // no active row
        .mockResolvedValueOnce({ ...activeRow, status: PaymentConnectionStatus.PENDING });

      await expect(service.requireActiveConnection(CLUB_ID)).rejects.toMatchObject({
        reason: PaymentConnectionStatus.PENDING,
      });
    });

    it('does not treat a disconnected connection as usable', async () => {
      repo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...activeRow, status: PaymentConnectionStatus.DISCONNECTED });

      await expect(service.requireActiveConnection(CLUB_ID)).rejects.toMatchObject({
        reason: PaymentConnectionStatus.DISCONNECTED,
      });
    });

    describe('legacy env shim', () => {
      it('does NOT shim when only the env token is set (flag off by default)', async () => {
        // Prod has sandbox GoCardless credentials in the environment: a
        // "successful" charge through them moves no money. With the fallback
        // flag unset, an unconnected club must be told to connect Stripe
        // instead of being routed to those credentials.
        repo.findOne.mockResolvedValue(null);
        configValues.GOCARDLESS_ACCESS_TOKEN = 'sandbox_abc';
        configValues.GOCARDLESS_ENVIRONMENT = 'sandbox';

        await expect(service.requireActiveConnection(CLUB_ID)).rejects.toThrow(
          ProviderNotConnectedException,
        );
      });

      it("does not treat a non-'true' flag value as enabling the shim", async () => {
        repo.findOne.mockResolvedValue(null);
        configValues.GOCARDLESS_ACCESS_TOKEN = 'sandbox_abc';
        configValues.LEGACY_GOCARDLESS_ENV_FALLBACK = '1';

        await expect(service.requireActiveConnection(CLUB_ID)).rejects.toThrow(
          ProviderNotConnectedException,
        );
      });

      it('falls back to Swimly env credentials when the flag is explicitly on', async () => {
        // Local demo environments seed GoCardless mandates directly and opt in
        // with LEGACY_GOCARDLESS_ENV_FALLBACK='true'.
        repo.findOne.mockResolvedValue(null);
        configValues.LEGACY_GOCARDLESS_ENV_FALLBACK = 'true';
        configValues.GOCARDLESS_ACCESS_TOKEN = 'sandbox_abc';
        configValues.GOCARDLESS_ENVIRONMENT = 'sandbox';

        const connection = await service.requireActiveConnection(CLUB_ID);

        expect(connection).toEqual({
          clubId: CLUB_ID,
          provider: 'gocardless',
          externalAccountId: LEGACY_ENV_ACCOUNT_REF,
          livemode: false,
          source: 'env',
          accessToken: 'sandbox_abc',
        });
      });

      it('marks the shim livemode only when GoCardless is pointed at live', async () => {
        repo.findOne.mockResolvedValue(null);
        configValues.LEGACY_GOCARDLESS_ENV_FALLBACK = 'true';
        configValues.GOCARDLESS_ACCESS_TOKEN = 'live_abc';
        configValues.GOCARDLESS_ENVIRONMENT = 'live';

        const connection = await service.requireActiveConnection(CLUB_ID);

        expect(connection.livemode).toBe(true);
      });

      it('prefers a real connection over the env shim', async () => {
        // A club that has connected its own account must never be billed
        // through Swimly's, even while the shim still exists.
        repo.findOne.mockResolvedValue(activeRow);
        configValues.LEGACY_GOCARDLESS_ENV_FALLBACK = 'true';
        configValues.GOCARDLESS_ACCESS_TOKEN = 'sandbox_abc';

        const connection = await service.requireActiveConnection(CLUB_ID);

        expect(connection.source).toBe('connection');
        expect(connection.provider).toBe('stripe');
      });

      it('throws rather than shimming when the flag is on but no env token is configured', async () => {
        repo.findOne.mockResolvedValue(null);
        configValues.LEGACY_GOCARDLESS_ENV_FALLBACK = 'true';

        await expect(service.requireActiveConnection(CLUB_ID)).rejects.toThrow(
          ProviderNotConnectedException,
        );
      });
    });
  });

  describe('providerForClub', () => {
    it("reports the active connection's provider", async () => {
      repo.findOne.mockResolvedValue(activeRow);

      await expect(service.providerForClub(CLUB_ID)).resolves.toBe('stripe');
    });

    it('reports gocardless when the legacy env shim is explicitly enabled', async () => {
      repo.findOne.mockResolvedValue(null);
      configValues.LEGACY_GOCARDLESS_ENV_FALLBACK = 'true';
      configValues.GOCARDLESS_ACCESS_TOKEN = 'sandbox_abc';

      await expect(service.providerForClub(CLUB_ID)).resolves.toBe('gocardless');
    });

    it('reports null when the env token is set but the fallback flag is not', async () => {
      // The /clubs/me display field must agree with requireActiveConnection:
      // if the club cannot actually collect, parents must not see Direct
      // Debit copy for a flow that would fail.
      repo.findOne.mockResolvedValue(null);
      configValues.GOCARDLESS_ACCESS_TOKEN = 'sandbox_abc';

      await expect(service.providerForClub(CLUB_ID)).resolves.toBeNull();
    });

    it('reports null when the club has no way to collect', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.providerForClub(CLUB_ID)).resolves.toBeNull();
    });

    it('never reports a pending connection as the provider', async () => {
      // The query is scoped to ACTIVE rows; a pending row must not surface.
      repo.findOne.mockResolvedValue(null);

      await service.providerForClub(CLUB_ID);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { club_id: CLUB_ID, status: PaymentConnectionStatus.ACTIVE },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findByExternalAccountId', () => {
    it('resolves the club behind a provider account id', async () => {
      repo.findOne.mockResolvedValue(activeRow);

      const found = await service.findByExternalAccountId('stripe', 'acct_123');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { provider: 'stripe', external_account_id: 'acct_123' },
      });
      expect(found).toBe(activeRow);
    });

    it('returns null for an unknown account', async () => {
      repo.findOne.mockResolvedValue(null);

      expect(await service.findByExternalAccountId('stripe', 'acct_nope')).toBeNull();
    });
  });
});
