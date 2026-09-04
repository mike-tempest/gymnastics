import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { ClubsRepository } from './clubs.repository';
import { Club, ClubStatus } from './entities/club.entity';
import { PaymentConnectionsService } from '../finance/payment-connections/payment-connections.service';
import {
  CLS_CLUB_ID_KEY,
  TenantContextService,
} from '../../common/tenancy/tenant-context.service';

const CLUB_A = 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLUB_B = 'club-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/** Minimal in-memory fake of ClsService, matching the tenancy reference specs. */
class FakeClsService {
  private store = new Map<string, unknown>();

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

describe('ClubsController', () => {
  let controller: ClubsController;
  let cls: FakeClsService;
  let findOneCalls: string[];

  // The provider each club would transact on. Default null (no connection, no
  // legacy env credentials); tests override per case.
  const mockPaymentConnections = {
    providerForClub: jest.fn(),
  };

  // Two clubs in the store, to prove /clubs/me never crosses tenants.
  const clubs: Array<Partial<Club>> = [
    {
      id: CLUB_A,
      name: 'Aylesbury Aquatics',
      slug: 'aylesbury-aquatics',
      country: 'GB',
      currency: 'GBP',
      timezone: 'Europe/London',
      locale: 'en-GB',
      governing_body: 'SWIM_ENGLAND',
      governing_body_region: 'London',
      status: ClubStatus.ACTIVE,
      swim_england_affiliate_number: 'SE-SECRET-A',
    },
    {
      id: CLUB_B,
      name: 'Boston Barracudas',
      slug: 'boston-barracudas',
      country: 'US',
      currency: 'USD',
      timezone: 'America/New_York',
      locale: 'en-US',
      status: ClubStatus.ACTIVE,
      swim_england_affiliate_number: 'SE-SECRET-B',
    },
  ];

  beforeEach(async () => {
    cls = new FakeClsService();
    findOneCalls = [];

    // Drives the real ClubsService and TenantContextService; only the
    // repository and CLS layer are faked, so the tenant resolution path the
    // controller uses in production is exercised for real.
    const fakeClubsRepository = {
      findOne: jest.fn((id: string) => {
        findOneCalls.push(id);
        return Promise.resolve(clubs.find((c) => c.id === id) ?? null);
      }),
    };

    mockPaymentConnections.providerForClub.mockReset();
    mockPaymentConnections.providerForClub.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClubsController],
      providers: [
        ClubsService,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: ClubsRepository, useValue: fakeClubsRepository },
        { provide: PaymentConnectionsService, useValue: mockPaymentConnections },
      ],
    }).compile();

    controller = module.get<ClubsController>(ClubsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /clubs/me', () => {
    it('returns the caller club only, resolved from the tenant context', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await controller.getMyClub();

      // Looked up strictly by the tenant context club id.
      expect(findOneCalls).toEqual([CLUB_A]);
      expect(result).toEqual({
        id: CLUB_A,
        name: 'Aylesbury Aquatics',
        country: 'GB',
        currency: 'GBP',
        timezone: 'Europe/London',
        locale: 'en-GB',
        governing_body: 'SWIM_ENGLAND',
        governing_body_region: 'London',
        // Unconfigured tax fields surface as null/false, so GB clubs that
        // have not set up tax render invoices exactly as before.
        tax_label: null,
        tax_inclusive: false,
        tax_registration_number: null,
        // No connection and no legacy credentials: the club cannot collect.
        payment_provider: null,
      });
    });

    it('returns club B for a club B caller (never crosses tenants)', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_B);

      const result = await controller.getMyClub();

      expect(findOneCalls).toEqual([CLUB_B]);
      expect(result.id).toBe(CLUB_B);
      expect(result.name).toBe('Boston Barracudas');
      expect(result.country).toBe('US');
      expect(result.currency).toBe('USD');
      expect(result.timezone).toBe('America/New_York');
      expect(result.locale).toBe('en-US');
    });

    it('exposes only the public shape, not internal club fields', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await controller.getMyClub();

      expect(Object.keys(result).sort()).toEqual([
        'country',
        'currency',
        'governing_body',
        'governing_body_region',
        'id',
        'locale',
        'name',
        'payment_provider',
        'tax_inclusive',
        'tax_label',
        'tax_registration_number',
        'timezone',
      ]);
      expect(result as unknown as Record<string, unknown>).not.toHaveProperty(
        'swim_england_affiliate_number',
      );
    });

    it("reports the active connection's provider, resolved for the caller club", async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);
      mockPaymentConnections.providerForClub.mockResolvedValue('stripe');

      const result = await controller.getMyClub();

      expect(mockPaymentConnections.providerForClub).toHaveBeenCalledWith(CLUB_A);
      expect(result.payment_provider).toBe('stripe');
    });

    it('reports gocardless for a legacy club still on environment credentials', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);
      mockPaymentConnections.providerForClub.mockResolvedValue('gocardless');

      const result = await controller.getMyClub();

      expect(result.payment_provider).toBe('gocardless');
    });

    it('throws when called without a tenant context', async () => {
      // No club id in CLS: the tenant context refuses to resolve, so the
      // endpoint can never fall back to an unscoped lookup.
      await expect(controller.getMyClub()).rejects.toThrow();
      expect(findOneCalls).toEqual([]);
    });
  });
});
