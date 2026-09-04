import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import {
  CLS_CLUB_ID_KEY,
  TenantContextService,
} from '../../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { ClubSettingsService } from './club-settings.service';
import { ClubSettings } from './club-settings.entity';
import { ClubsService } from '../../clubs/clubs.service';
import { ClubsRepository } from '../../clubs/clubs.repository';

/**
 * Cross-tenant isolation test for the admin/settings module (Group H).
 *
 * Modelled on src/modules/swimmers/swimmers.tenant-isolation.spec.ts. It drives
 * the real ClubSettingsService through the real TenantScopedHelper /
 * TenantContextService, faking ClsService and the TypeORM repository so no live
 * database is needed.
 *
 * club_settings is now one row per club (UNIQUE(club_id)). The assertions prove:
 *
 *  - getSettings returns ONLY the caller's club row, never another club's
 *  - getSettings never sees a row belonging to a different club (would behave
 *    as not-found and create a fresh, club-stamped default)
 *  - updateSettings targets the caller's club row only
 *  - a club_id supplied in the payload is overridden by the context club
 */

/** Minimal in-memory fake of ClsService, matching the swimmers reference spec. */
class FakeClsService {
  private store = new Map<string, unknown>();

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

const CLUB_A = 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLUB_B = 'club-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SETTINGS_IN_A = 'settings-1111-in-club-a';
const SETTINGS_IN_B = 'settings-2222-in-club-b';

describe('ClubSettingsService tenant isolation', () => {
  let service: ClubSettingsService;
  let cls: FakeClsService;

  let findOneCalls: ObjectLiteral[];
  let savedEntities: ObjectLiteral[];

  // One settings row per club, to prove cross-tenant reads never leak.
  const rows: Array<Partial<ClubSettings>> = [
    { settings_id: SETTINGS_IN_A, club_name: 'Club A Swim', club_id: CLUB_A },
    { settings_id: SETTINGS_IN_B, club_name: 'Club B Swim', club_id: CLUB_B },
  ];

  function matches(row: Partial<ClubSettings>, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => row[key as keyof ClubSettings] === value);
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    findOneCalls = [];
    savedEntities = [];

    const fakeTypeOrmRepo = {
      findOne: jest.fn((options: ObjectLiteral) => {
        findOneCalls.push(options.where);
        return Promise.resolve(rows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        savedEntities.push(entity);
        return Promise.resolve({ settings_id: 'new-id', ...entity });
      }),
    } as unknown as Repository<ClubSettings>;

    // Every club id resolves to a GB club; the regional fields are merged
    // into responses from the clubs row but play no part in row scoping.
    const fakeClubsRepository = {
      findOne: jest.fn((id: string) =>
        Promise.resolve({
          id,
          name: 'Fake Club',
          country: 'GB',
          currency: 'GBP',
          timezone: 'Europe/London',
          locale: 'en-GB',
        }),
      ),
      save: jest.fn((club: ObjectLiteral) => Promise.resolve(club)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubSettingsService,
        ClubsService,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(ClubSettings), useValue: fakeTypeOrmRepo },
        { provide: ClubsRepository, useValue: fakeClubsRepository },
      ],
    }).compile();

    service = module.get(ClubSettingsService);
  });

  describe('getSettings returns only the caller club row', () => {
    it('returns club A row for an admin of club A', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await service.getSettings();

      expect(findOneCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result.settings_id).toBe(SETTINGS_IN_A);
      expect(result.club_id).toBe(CLUB_A);
    });

    it('returns club B row for an admin of club B (never crosses)', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_B);

      const result = await service.getSettings();

      expect(findOneCalls[0]).toEqual({ club_id: CLUB_B });
      expect(result.settings_id).toBe(SETTINGS_IN_B);
      expect(result.club_id).toBe(CLUB_B);
    });

    it('never returns another club row even when the active club has no row yet', async () => {
      const CLUB_C = 'club-cccccccc-cccc-cccc-cccc-cccccccccccc';
      cls.set(CLS_CLUB_ID_KEY, CLUB_C);

      // No row exists for CLUB_C, so a fresh default is created and stamped with
      // CLUB_C; club A's and club B's rows are never seen.
      const result = await service.getSettings();

      expect(findOneCalls[0]).toEqual({ club_id: CLUB_C });
      expect(savedEntities[0]).toMatchObject({ club_id: CLUB_C });
      expect(result.club_id).toBe(CLUB_C);
      expect(result.settings_id).not.toBe(SETTINGS_IN_A);
      expect(result.settings_id).not.toBe(SETTINGS_IN_B);
    });
  });

  describe('updateSettings targets only the caller club row', () => {
    it('scopes the lookup by club_id and re-stamps the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await service.updateSettings({ club_name: 'Renamed A' });

      expect(findOneCalls[0]).toEqual({ club_id: CLUB_A });
      expect(savedEntities[0]).toMatchObject({
        settings_id: SETTINGS_IN_A,
        club_name: 'Renamed A',
        club_id: CLUB_A,
      });
      expect(result.club_id).toBe(CLUB_A);
    });

    it('overrides a club_id supplied in the payload with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // Attacker tries to retarget club B's row.
      await service.updateSettings({
        club_name: 'Hijack',
        club_id: CLUB_B,
      } as unknown as Parameters<ClubSettingsService['updateSettings']>[0]);

      // The lookup still scoped to club A; the saved row stays in club A.
      expect(findOneCalls[0]).toEqual({ club_id: CLUB_A });
      expect(savedEntities[0]).toMatchObject({ club_id: CLUB_A });
      expect(savedEntities[0].club_id).not.toBe(CLUB_B);
    });
  });
});
