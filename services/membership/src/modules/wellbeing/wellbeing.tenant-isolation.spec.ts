import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { WellbeingRepository } from './wellbeing.repository';
import { WellbeingLog } from './entities/wellbeing-log.entity';
import { CycleLog } from './entities/cycle-log.entity';
import { CreateWellbeingLogDto } from './dto/create-wellbeing-log.dto';
import { CreateCycleLogDto } from './dto/create-cycle-log.dto';
import { UpdateCycleLogDto } from './dto/update-cycle-log.dto';

/**
 * Cross-tenant isolation test for the wellbeing module (Group G).
 *
 * Modelled on src/modules/members/members.tenant-isolation.spec.ts. It drives
 * the real WellbeingRepository through the real TenantScopedHelper /
 * TenantContextService, faking ClsService and the two TypeORM repositories so no
 * live database is needed. Cycle logs and wellbeing logs are children of
 * members; the assertions prove the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's log id behaves as not-found (null)
 *  - create stamps the context club_id and drops any supplied club_id
 *  - update/delete scope the affected-row predicate by club_id
 */

/** Minimal in-memory fake of ClsService, matching tenant-scoped.helper.spec.ts. */
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
const MEMBER_IN_A = 'member-1111-in-club-a';
const MEMBER_IN_B = 'member-2222-in-club-b';
const WB_LOG_IN_A = 'wb-log-1111-in-club-a';
const WB_LOG_IN_B = 'wb-log-2222-in-club-b';
const CYCLE_LOG_IN_A = 'cycle-log-1111-in-club-a';
const CYCLE_LOG_IN_B = 'cycle-log-2222-in-club-b';

describe('WellbeingRepository tenant isolation', () => {
  let repo: WellbeingRepository;
  let cls: FakeClsService;

  // Records of what the fake TypeORM repositories were asked to do.
  let wbFindCalls: ObjectLiteral[];
  let wbFindOneCalls: ObjectLiteral[];
  let wbUpdateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let wbSavedEntities: ObjectLiteral[];

  let cycleFindCalls: ObjectLiteral[];
  let cycleFindOneCalls: ObjectLiteral[];
  let cycleUpdateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let cycleDeleteCalls: ObjectLiteral[];
  let cycleSavedEntities: ObjectLiteral[];

  // In-memory data sets spanning two clubs to prove cross-tenant reads never
  // leak. The fakes honour the club_id merged into the where clause.
  const wbRows: Array<Partial<WellbeingLog>> = [
    {
      log_id: WB_LOG_IN_A,
      member_id: MEMBER_IN_A,
      club_id: CLUB_A,
      log_date: '2026-05-25' as unknown as Date,
    },
    {
      log_id: WB_LOG_IN_B,
      member_id: MEMBER_IN_B,
      club_id: CLUB_B,
      log_date: '2026-05-25' as unknown as Date,
    },
  ];
  const cycleRows: Array<Partial<CycleLog>> = [
    { log_id: CYCLE_LOG_IN_A, member_id: MEMBER_IN_A, club_id: CLUB_A },
    { log_id: CYCLE_LOG_IN_B, member_id: MEMBER_IN_B, club_id: CLUB_B },
  ];

  function matches<T extends ObjectLiteral>(row: Partial<T>, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => row[key as keyof T] === value);
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    wbFindCalls = [];
    wbFindOneCalls = [];
    wbUpdateCalls = [];
    wbSavedEntities = [];
    cycleFindCalls = [];
    cycleFindOneCalls = [];
    cycleUpdateCalls = [];
    cycleDeleteCalls = [];
    cycleSavedEntities = [];

    const fakeWellbeingRepo = {
      find: jest.fn((options: ObjectLiteral) => {
        wbFindCalls.push(options.where);
        return Promise.resolve(wbRows.filter((r) => matches(r, options.where)));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        wbFindOneCalls.push(options.where);
        return Promise.resolve(wbRows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        wbSavedEntities.push(entity);
        return Promise.resolve({ log_id: 'new-wb-id', ...entity });
      }),
      update: jest.fn((criteria: ObjectLiteral, partial: ObjectLiteral) => {
        wbUpdateCalls.push({ criteria, partial });
        return Promise.resolve({ affected: 1 });
      }),
    } as unknown as Repository<WellbeingLog>;

    const fakeCycleRepo = {
      find: jest.fn((options: ObjectLiteral) => {
        cycleFindCalls.push(options.where);
        return Promise.resolve(cycleRows.filter((r) => matches(r, options.where)));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        cycleFindOneCalls.push(options.where);
        return Promise.resolve(cycleRows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        cycleSavedEntities.push(entity);
        return Promise.resolve({ log_id: 'new-cycle-id', ...entity });
      }),
      update: jest.fn((criteria: ObjectLiteral, partial: ObjectLiteral) => {
        cycleUpdateCalls.push({ criteria, partial });
        return Promise.resolve({ affected: 1 });
      }),
      delete: jest.fn((criteria: ObjectLiteral) => {
        cycleDeleteCalls.push(criteria);
        return Promise.resolve({ affected: 1 });
      }),
    } as unknown as Repository<CycleLog>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WellbeingRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(WellbeingLog), useValue: fakeWellbeingRepo },
        { provide: getRepositoryToken(CycleLog), useValue: fakeCycleRepo },
      ],
    }).compile();

    repo = module.get(WellbeingRepository);
  });

  describe('wellbeing log reads are scoped to the active club', () => {
    it('findWellbeingByMember merges club_id with the member filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findWellbeingByMember(MEMBER_IN_A);

      expect(wbFindCalls[0]).toEqual({ member_id: MEMBER_IN_A, club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].log_id).toBe(WB_LOG_IN_A);
    });

    it('findWellbeingByMember never returns another club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // The member lives in CLUB_B, so a CLUB_A caller sees nothing.
      const result = await repo.findWellbeingByMember(MEMBER_IN_B);

      expect(wbFindCalls[0]).toEqual({ member_id: MEMBER_IN_B, club_id: CLUB_A });
      expect(result).toHaveLength(0);
    });

    it('findTodayWellbeing scopes the lookup by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findTodayWellbeing(MEMBER_IN_A);

      expect(wbFindOneCalls[0]).toMatchObject({
        member_id: MEMBER_IN_A,
        club_id: CLUB_A,
      });
    });

    it('findWellbeingByDate scopes the In(...) query by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findWellbeingByDate([MEMBER_IN_A, MEMBER_IN_B], '2026-05-25');

      expect(wbFindCalls[0]).toMatchObject({ club_id: CLUB_A });
    });

    it('findWellbeingByDate short-circuits on an empty id list', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findWellbeingByDate([], '2026-05-25');

      expect(result).toEqual([]);
      expect(wbFindCalls).toHaveLength(0);
    });
  });

  describe('wellbeing log writes stamp and scope club_id', () => {
    it('createWellbeingLog stamps the context club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateWellbeingLogDto = {
        member_id: MEMBER_IN_A,
        log_date: '2026-05-25',
        energy_level: 4,
        comfort_in_water: 4,
      };

      await repo.createWellbeingLog(dto);

      expect(wbSavedEntities[0]).toMatchObject({
        member_id: MEMBER_IN_A,
        club_id: CLUB_A,
      });
    });

    it('createWellbeingLog overrides a supplied club_id with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto = {
        member_id: MEMBER_IN_A,
        log_date: '2026-05-25',
        energy_level: 4,
        comfort_in_water: 4,
        // Attacker tries to plant a row in another club.
        club_id: CLUB_B,
      } as CreateWellbeingLogDto;

      await repo.createWellbeingLog(dto);

      expect(wbSavedEntities[0]).toMatchObject({ club_id: CLUB_A });
      expect(wbSavedEntities[0].club_id).not.toBe(CLUB_B);
    });

    it('upsertWellbeingLog scopes the existing-row lookup and update by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.upsertWellbeingLog({
        member_id: MEMBER_IN_A,
        log_date: '2026-05-25',
        energy_level: 5,
        comfort_in_water: 5,
      });

      // The existence check is club-scoped.
      expect(wbFindOneCalls[0]).toMatchObject({
        member_id: MEMBER_IN_A,
        club_id: CLUB_A,
      });
      // The matched row belongs to CLUB_A, so the update is scoped by club_id.
      expect(wbUpdateCalls[0].criteria).toEqual({
        log_id: WB_LOG_IN_A,
        club_id: CLUB_A,
      });
      expect(wbUpdateCalls[0].partial).not.toHaveProperty('club_id');
    });

    it('upsertWellbeingLog creates a fresh row when the existing one is in another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // MEMBER_IN_B's log exists but in CLUB_B, so for CLUB_A it is not-found
      // and a new (club-stamped) row is created instead of mutating CLUB_B's.
      await repo.upsertWellbeingLog({
        member_id: MEMBER_IN_B,
        log_date: '2026-05-25',
        energy_level: 3,
        comfort_in_water: 3,
      });

      expect(wbUpdateCalls).toHaveLength(0);
      expect(wbSavedEntities[0]).toMatchObject({ club_id: CLUB_A });
    });
  });

  describe('cycle log reads behave as not-found across tenants', () => {
    it('findCycleLogsByMember merges club_id with the member filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findCycleLogsByMember(MEMBER_IN_A);

      expect(cycleFindCalls[0]).toEqual({ member_id: MEMBER_IN_A, club_id: CLUB_A });
      expect(result).toHaveLength(1);
    });

    it('findOneCycleLog returns the row when it belongs to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOneCycleLog(CYCLE_LOG_IN_A);

      expect(cycleFindOneCalls[0]).toEqual({ log_id: CYCLE_LOG_IN_A, club_id: CLUB_A });
      expect(result?.log_id).toBe(CYCLE_LOG_IN_A);
    });

    it('findOneCycleLog returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOneCycleLog(CYCLE_LOG_IN_B);

      expect(cycleFindOneCalls[0]).toEqual({ log_id: CYCLE_LOG_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });
  });

  describe('cycle log writes stamp and scope club_id', () => {
    it('createCycleLog stamps the context club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateCycleLogDto = {
        member_id: MEMBER_IN_A,
        period_start: '2026-05-01',
      };

      await repo.createCycleLog(dto);

      expect(cycleSavedEntities[0]).toMatchObject({
        member_id: MEMBER_IN_A,
        club_id: CLUB_A,
      });
    });

    it('createCycleLog overrides a supplied club_id with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto = {
        member_id: MEMBER_IN_A,
        period_start: '2026-05-01',
        club_id: CLUB_B,
      } as CreateCycleLogDto;

      await repo.createCycleLog(dto);

      expect(cycleSavedEntities[0]).toMatchObject({ club_id: CLUB_A });
      expect(cycleSavedEntities[0].club_id).not.toBe(CLUB_B);
    });

    it('updateCycleLog scopes the affected-row predicate and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateCycleLog(CYCLE_LOG_IN_A, {
        notes: 'updated',
        club_id: CLUB_B,
      } as unknown as UpdateCycleLogDto);

      expect(cycleUpdateCalls[0].criteria).toEqual({
        log_id: CYCLE_LOG_IN_A,
        club_id: CLUB_A,
      });
      expect(cycleUpdateCalls[0].partial).not.toHaveProperty('club_id');
      expect(cycleUpdateCalls[0].partial).toMatchObject({ notes: 'updated' });
    });

    it('removeCycleLog includes club_id in the delete criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.removeCycleLog(CYCLE_LOG_IN_A);

      expect(cycleDeleteCalls[0]).toEqual({ log_id: CYCLE_LOG_IN_A, club_id: CLUB_A });
    });
  });
});
