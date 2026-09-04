import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeConnectService } from './stripe-connect.service';
import { PaymentConnectionStatus } from './entities/club-payment-connection.entity';

jest.mock('stripe');

const MockedStripe = Stripe as unknown as jest.Mock;

describe('StripeConnectService', () => {
  const CLUB_ID = 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const accounts = { create: jest.fn(), retrieve: jest.fn() };
  const accountLinks = { create: jest.fn() };

  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(),
  };

  const clubsRepository = {
    findOne: jest.fn(),
  };

  const makeService = (secretKey?: string, appUrl = 'https://app.swimly.uk') => {
    const values: Record<string, string | undefined> = {
      STRIPE_SECRET_KEY: secretKey,
      APP_URL: appUrl,
    };
    const configService = {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    return new StripeConnectService(
      configService,
      repository as never,
      clubsRepository as never,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedStripe.mockImplementation(() => ({ accounts, accountLinks }));
    repository.find.mockResolvedValue([]);
    repository.findOne.mockResolvedValue(null);
    repository.save.mockImplementation((row: unknown) => Promise.resolve(row));
    clubsRepository.findOne.mockResolvedValue({
      id: CLUB_ID,
      country: 'GB',
      contact_email: 'treasurer@club.example',
    });
    accounts.create.mockResolvedValue({ id: 'acct_new' });
    accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.com/setup/x' });
  });

  describe('configuration', () => {
    it('is dormant without STRIPE_SECRET_KEY', () => {
      expect(makeService(undefined).isConfigured()).toBe(false);
    });

    it('refuses to start onboarding while unconfigured', async () => {
      await expect(makeService(undefined).startOnboarding(CLUB_ID)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('startOnboarding', () => {
    it('creates an Express account, a pending row, and an onboarding link', async () => {
      const service = makeService('sk_test_1');

      const result = await service.startOnboarding(CLUB_ID);

      expect(accounts.create).toHaveBeenCalledWith({
        type: 'express',
        country: 'GB',
        email: 'treasurer@club.example',
        metadata: { club_id: CLUB_ID },
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          club_id: CLUB_ID,
          provider: 'stripe',
          external_account_id: 'acct_new',
          status: PaymentConnectionStatus.PENDING,
          // A test key mints test-mode connections.
          livemode: false,
        }),
      );
      expect(accountLinks.create).toHaveBeenCalledWith({
        account: 'acct_new',
        type: 'account_onboarding',
        return_url: 'https://app.swimly.uk/admin/settings?stripe=return',
        refresh_url: 'https://app.swimly.uk/admin/settings?stripe=refresh',
      });
      expect(result).toEqual({ url: 'https://connect.stripe.com/setup/x' });
    });

    it('records livemode true under a live platform key', async () => {
      await makeService('sk_live_1').startOnboarding(CLUB_ID);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ livemode: true }),
      );
    });

    it('reuses a pending connection and only mints a fresh link', async () => {
      repository.find.mockResolvedValue([
        {
          club_id: CLUB_ID,
          provider: 'stripe',
          external_account_id: 'acct_pending',
          status: PaymentConnectionStatus.PENDING,
        },
      ]);

      const result = await makeService('sk_test_1').startOnboarding(CLUB_ID);

      expect(accounts.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
      expect(accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'acct_pending' }),
      );
      expect(result.url).toBe('https://connect.stripe.com/setup/x');
    });

    it('409s when the club is actively connected to another provider', async () => {
      repository.find.mockResolvedValue([
        {
          club_id: CLUB_ID,
          provider: 'gocardless',
          external_account_id: 'OR123',
          status: PaymentConnectionStatus.ACTIVE,
        },
      ]);

      await expect(makeService('sk_test_1').startOnboarding(CLUB_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(accounts.create).not.toHaveBeenCalled();
    });
  });

  describe('syncForClub', () => {
    const pendingRow = () => ({
      club_id: CLUB_ID,
      provider: 'stripe',
      external_account_id: 'acct_1',
      status: PaymentConnectionStatus.PENDING,
      capabilities: {},
      livemode: false,
      connected_at: null,
    });

    it('404s when the club never started connecting Stripe', async () => {
      await expect(makeService('sk_test_1').syncForClub(CLUB_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('activates a submitted, chargeable account and stamps connected_at', async () => {
      repository.findOne.mockResolvedValue(pendingRow());
      accounts.retrieve.mockResolvedValue({
        id: 'acct_1',
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [], disabled_reason: null },
      });

      const result = await makeService('sk_test_1').syncForClub(CLUB_ID);

      expect(accounts.retrieve).toHaveBeenCalledWith('acct_1');
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentConnectionStatus.ACTIVE,
          connected_at: expect.any(Date),
        }),
      );
      expect(result).toEqual({
        configured: true,
        provider: 'stripe',
        status: 'active',
        livemode: false,
        external_account_id: 'acct_1',
        capabilities: {
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements_due: [],
        },
      });
    });

    it('keeps a half-onboarded account pending, not restricted', async () => {
      // Mid-onboarding accounts carry disabled_reason requirements.past_due;
      // that is "never finished", not "finished and then limited".
      repository.findOne.mockResolvedValue(pendingRow());
      accounts.retrieve.mockResolvedValue({
        id: 'acct_1',
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
        requirements: {
          currently_due: ['external_account'],
          disabled_reason: 'requirements.past_due',
        },
      });

      const result = await makeService('sk_test_1').syncForClub(CLUB_ID);

      expect(result.status).toBe('pending');
      expect(result.capabilities?.requirements_due).toEqual(['external_account']);
    });

    it('marks a submitted account Stripe has disabled as restricted', async () => {
      repository.findOne.mockResolvedValue({
        ...pendingRow(),
        status: PaymentConnectionStatus.ACTIVE,
      });
      accounts.retrieve.mockResolvedValue({
        id: 'acct_1',
        details_submitted: true,
        charges_enabled: false,
        payouts_enabled: false,
        requirements: {
          currently_due: ['individual.verification.document'],
          disabled_reason: 'requirements.pending_verification',
        },
      });

      const result = await makeService('sk_test_1').syncForClub(CLUB_ID);

      expect(result.status).toBe('restricted');
    });
  });

  describe('syncByAccountId (webhook path)', () => {
    it('syncs a known account', async () => {
      repository.findOne.mockResolvedValue({
        club_id: CLUB_ID,
        provider: 'stripe',
        external_account_id: 'acct_1',
        status: PaymentConnectionStatus.PENDING,
        capabilities: {},
        livemode: false,
        connected_at: null,
      });
      accounts.retrieve.mockResolvedValue({
        id: 'acct_1',
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [], disabled_reason: null },
      });

      await makeService('sk_test_1').syncByAccountId('acct_1');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentConnectionStatus.ACTIVE }),
      );
    });

    it('tolerates an unknown account without throwing', async () => {
      // The webhook endpoint must keep answering 200; an unknown account is a
      // half-finished or removed connection, not a failure we can fix.
      await expect(makeService('sk_test_1').syncByAccountId('acct_ghost')).resolves.toBeUndefined();
      expect(accounts.retrieve).not.toHaveBeenCalled();
    });

    it('tolerates an unconfigured platform without throwing', async () => {
      await expect(makeService(undefined).syncByAccountId('acct_1')).resolves.toBeUndefined();
    });
  });

  describe('getStatusForClub', () => {
    it("reports 'none' when the club has no connection row", async () => {
      const result = await makeService('sk_test_1').getStatusForClub(CLUB_ID);

      expect(result).toEqual({
        configured: true,
        provider: null,
        status: 'none',
        livemode: null,
        external_account_id: null,
        capabilities: null,
      });
    });

    it("reports 'none' with configured false when the platform has no key", async () => {
      const result = await makeService(undefined).getStatusForClub(CLUB_ID);

      expect(result.configured).toBe(false);
      expect(result.status).toBe('none');
    });

    it('reports the newest connection from persisted state without calling Stripe', async () => {
      repository.findOne.mockResolvedValue({
        club_id: CLUB_ID,
        provider: 'stripe',
        external_account_id: 'acct_1',
        status: PaymentConnectionStatus.ACTIVE,
        livemode: true,
        capabilities: {
          charges_enabled: true,
          payouts_enabled: false,
          details_submitted: true,
          requirements_due: ['external_account'],
        },
      });

      const result = await makeService('sk_test_1').getStatusForClub(CLUB_ID);

      expect(accounts.retrieve).not.toHaveBeenCalled();
      expect(result).toEqual({
        configured: true,
        provider: 'stripe',
        status: 'active',
        livemode: true,
        external_account_id: 'acct_1',
        capabilities: {
          charges_enabled: true,
          payouts_enabled: false,
          details_submitted: true,
          requirements_due: ['external_account'],
        },
      });
    });
  });
});
