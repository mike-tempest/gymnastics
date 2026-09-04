import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { SessionsRepository } from './sessions.repository';
import { Session, SessionStatus } from './entities/session.entity';
import { CreateSessionDto } from './dto/create-session.dto';

/**
 * Cross-tenant isolation test for the sessions module (Group D).
 *
 * Modelled on src/modules/swimmers/swimmers.tenant-isolation.spec.ts. It drives
 * the real SessionsRepository through the real TenantScopedHelper /
 * TenantContextService, but fakes ClsService and the TypeORM repository so no
 * live database is needed. The assertions prove the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's id behaves as not-found (null)
 *  - the query-builder reads (findUpcoming) are pre-filtered by club_id
 *  - create stamps the context club_id
 *  - a club_id supplied in the input is overridden by the context
 *  - update/delete scope the affected-row predicate by club_id
 *  - the @Cron sweep (findSessionsForRemindersBetween) stays cross-club: it must
 *    NOT inject club_id, because it runs without a request/CLS context.
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
const SESSION_IN_A = 'session-1111-in-club-a';
const SESSION_IN_B = 'session-2222-in-club-b';

describe('SessionsRepository tenant isolation', () => {
  let repo: SessionsRepository;
  let cls: FakeClsService;

  // Records of what the fake TypeORM repository was asked to do.
  let findCalls: ObjectLiteral[];
  let findOneCalls: ObjectLiteral[];
  let updateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let deleteCalls: ObjectLiteral[];
  let savedEntities: ObjectLiteral[];
  let countCalls: ObjectLiteral[];

  // Records of the query-builder usage so we can assert the club scope.
  let qbWhereCalls: Array<{ clause: string; params?: ObjectLiteral }>;
  let qbAndWhereCalls: Array<{ clause: string; params?: ObjectLiteral }>;

  // A tiny in-memory data set spanning two clubs to prove cross-tenant reads
  // never leak. The fake honours the club_id merged into the where clause.
  const rows: Array<Partial<Session>> = [
    { session_id: SESSION_IN_A, session_name: 'Morning A', club_id: CLUB_A },
    { session_id: SESSION_IN_B, session_name: 'Morning B', club_id: CLUB_B },
  ];

  function matches(row: Partial<Session>, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => row[key as keyof Session] === value);
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    findCalls = [];
    findOneCalls = [];
    updateCalls = [];
    deleteCalls = [];
    savedEntities = [];
    countCalls = [];
    qbWhereCalls = [];
    qbAndWhereCalls = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeQueryBuilder: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn((clause: string, params?: ObjectLiteral) => {
        qbWhereCalls.push({ clause, params });
        return fakeQueryBuilder;
      }),
      andWhere: jest.fn((clause: string, params?: ObjectLiteral) => {
        qbAndWhereCalls.push({ clause, params });
        return fakeQueryBuilder;
      }),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(() => Promise.resolve([])),
    };

    const fakeTypeOrmRepo = {
      find: jest.fn((options: ObjectLiteral) => {
        findCalls.push(options.where);
        return Promise.resolve(rows.filter((r) => matches(r, options.where)));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        findOneCalls.push(options.where);
        return Promise.resolve(rows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        savedEntities.push(entity);
        return Promise.resolve({ session_id: 'new-id', ...entity });
      }),
      update: jest.fn((criteria: ObjectLiteral, partial: ObjectLiteral) => {
        updateCalls.push({ criteria, partial });
        return Promise.resolve({ affected: 1 });
      }),
      delete: jest.fn((criteria: ObjectLiteral) => {
        deleteCalls.push(criteria);
        return Promise.resolve({ affected: 1 });
      }),
      count: jest.fn((options: ObjectLiteral) => {
        countCalls.push(options.where);
        return Promise.resolve(1);
      }),
      createQueryBuilder: jest.fn(() => fakeQueryBuilder),
    } as unknown as Repository<Session>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Session), useValue: fakeTypeOrmRepo },
      ],
    }).compile();

    repo = module.get(SessionsRepository);
  });

  describe('reads are scoped to the active club', () => {
    it('findAll injects club_id and returns only this club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAll();

      expect(findCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].session_id).toBe(SESSION_IN_A);
    });

    it('findBySquad merges club_id with the squad filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findBySquad('squad-x');

      expect(findCalls[0]).toEqual({ squad_id: 'squad-x', club_id: CLUB_A });
    });

    it('findByStatus merges club_id with the status filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findByStatus(SessionStatus.SCHEDULED);

      expect(findCalls[0]).toEqual({ status: SessionStatus.SCHEDULED, club_id: CLUB_A });
    });

    it('findByDateRange merges club_id with the date filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findByDateRange(new Date('2026-01-01'), new Date('2026-01-31'));

      expect(findCalls[0]).toHaveProperty('club_id', CLUB_A);
      expect(findCalls[0]).toHaveProperty('session_date');
    });

    it('findUpcoming pre-filters the query builder by the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findUpcoming(5);

      // The scoped query builder seeds WHERE session.club_id = :clubId.
      expect(qbWhereCalls[0].clause).toContain('club_id');
      expect(qbWhereCalls[0].params).toEqual({ clubId: CLUB_A });
    });

    it('count is scoped to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.count();

      expect(countCalls[0]).toEqual({ club_id: CLUB_A });
    });
  });

  describe('findOne behaves as not-found across tenants', () => {
    it('returns the row when it belongs to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOne(SESSION_IN_A);

      expect(findOneCalls[0]).toEqual({ session_id: SESSION_IN_A, club_id: CLUB_A });
      expect(result?.session_id).toBe(SESSION_IN_A);
    });

    it('returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // SESSION_IN_B exists, but not in CLUB_A, so the scoped lookup is null.
      const result = await repo.findOne(SESSION_IN_B);

      expect(findOneCalls[0]).toEqual({ session_id: SESSION_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });
  });

  describe('create stamps the context club_id', () => {
    it('stamps club_id from the active tenant', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateSessionDto = {
        session_name: 'Evening Squad',
        session_date: '2026-02-01',
        start_time: '18:00',
        end_time: '19:30',
      };

      await repo.create(dto);

      expect(savedEntities[0]).toMatchObject({ session_name: 'Evening Squad', club_id: CLUB_A });
    });

    it('overrides a club_id supplied in the input with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto = {
        session_name: 'Sneaky Squad',
        session_date: '2026-02-01',
        start_time: '18:00',
        end_time: '19:30',
        // Attacker tries to plant a row in another club.
        club_id: CLUB_B,
      } as CreateSessionDto & { club_id: string };

      await repo.create(dto);

      // The injected club_id wins; the supplied CLUB_B is discarded.
      expect(savedEntities[0]).toMatchObject({ club_id: CLUB_A });
      expect(savedEntities[0].club_id).not.toBe(CLUB_B);
    });
  });

  describe('update and delete scope the affected-row predicate by club_id', () => {
    it('update includes club_id in the criteria and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.update(SESSION_IN_A, {
        session_name: 'Renamed',
        club_id: CLUB_B,
      } as CreateSessionDto & { club_id: string });

      expect(updateCalls[0].criteria).toEqual({ session_id: SESSION_IN_A, club_id: CLUB_A });
      expect(updateCalls[0].partial).not.toHaveProperty('club_id');
      expect(updateCalls[0].partial).toMatchObject({ session_name: 'Renamed' });
    });

    it('delete includes club_id in the criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.remove(SESSION_IN_A);

      expect(deleteCalls[0]).toEqual({ session_id: SESSION_IN_A, club_id: CLUB_A });
    });
  });

  describe('background cron sweep stays cross-club', () => {
    it('findSessionsForRemindersBetween does NOT inject club_id (no request context)', async () => {
      // Deliberately leave the CLS club_id unset, mirroring an @Cron invocation.
      await repo.findSessionsForRemindersBetween('2026-03-16', '2026-03-18');

      // The reminder sweep must scan every club, so none of its query-builder
      // clauses may reference club_id. The tenant is derived later from each
      // loaded session row, not from getClubId().
      const allClauses = [...qbWhereCalls, ...qbAndWhereCalls].map((c) => c.clause);
      expect(allClauses.some((clause) => clause.includes('club_id'))).toBe(false);
    });
  });
});
