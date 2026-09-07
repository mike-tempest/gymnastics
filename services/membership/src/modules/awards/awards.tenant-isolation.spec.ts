import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { AwardsRepository } from './awards.repository';
import { AwardScheme } from './entities/award-scheme.entity';
import { AwardLevel } from './entities/award-level.entity';
import { MemberAwardProgress } from './entities/member-award-progress.entity';
import { AssessmentEvent, AssessmentOutcome } from './entities/assessment-event.entity';
import { CreateAwardSchemeDto } from './dto/award-scheme.dto';
import { CreateAwardLevelDto } from './dto/award-level.dto';

/**
 * Cross-tenant isolation test for the awards module (TEM-18).
 *
 * Modelled on src/modules/wellbeing/wellbeing.tenant-isolation.spec.ts. It
 * drives the real AwardsRepository through the real TenantScopedHelper /
 * TenantContextService, faking ClsService and the five TypeORM repositories so
 * no live database is needed. The assertions prove the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's id behaves as not-found (null)
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
const SCHEME_IN_A = 'scheme-1111-in-club-a';
const SCHEME_IN_B = 'scheme-2222-in-club-b';
const LEVEL_IN_A = 'level-1111-in-club-a';
const LEVEL_IN_B = 'level-2222-in-club-b';
const PROGRESS_IN_A = 'progress-1111-in-club-a';
const PROGRESS_IN_B = 'progress-2222-in-club-b';
const EVENT_IN_A = 'event-1111-in-club-a';
const OUTCOME_IN_A = 'outcome-1111-in-club-a';

interface RepoCalls {
  find: ObjectLiteral[];
  findOne: ObjectLiteral[];
  update: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  delete: ObjectLiteral[];
  saved: ObjectLiteral[];
}

function matches<T extends ObjectLiteral>(row: Partial<T>, where: ObjectLiteral): boolean {
  return Object.entries(where).every(([key, value]) => row[key as keyof T] === value);
}

/**
 * Builds a fake TypeORM repository over an in-memory row set that honours the
 * club_id merged into the where clause, and records every call.
 */
function makeFakeRepo<T extends ObjectLiteral>(
  rows: Array<Partial<T>>,
  idField: string,
): { repo: Repository<T>; calls: RepoCalls } {
  const calls: RepoCalls = { find: [], findOne: [], update: [], delete: [], saved: [] };

  const repo = {
    find: jest.fn((options: ObjectLiteral) => {
      calls.find.push(options.where);
      return Promise.resolve(rows.filter((row) => matches(row, options.where)));
    }),
    findOne: jest.fn((options: ObjectLiteral) => {
      calls.findOne.push(options.where);
      return Promise.resolve(rows.find((row) => matches(row, options.where)) ?? null);
    }),
    create: jest.fn((entityLike: ObjectLiteral) => entityLike),
    save: jest.fn((entity: ObjectLiteral) => {
      calls.saved.push(entity);
      return Promise.resolve({ [idField]: `new-${idField}`, ...entity });
    }),
    update: jest.fn((criteria: ObjectLiteral, partial: ObjectLiteral) => {
      calls.update.push({ criteria, partial });
      return Promise.resolve({ affected: 1 });
    }),
    delete: jest.fn((criteria: ObjectLiteral) => {
      calls.delete.push(criteria);
      return Promise.resolve({ affected: 1 });
    }),
  } as unknown as Repository<T>;

  return { repo, calls };
}

describe('AwardsRepository tenant isolation', () => {
  let repo: AwardsRepository;
  let cls: FakeClsService;

  let schemeCalls: RepoCalls;
  let levelCalls: RepoCalls;
  let progressCalls: RepoCalls;
  let eventCalls: RepoCalls;
  let outcomeCalls: RepoCalls;

  // Data sets spanning two clubs, so a cross-tenant read that leaked would
  // return the other club's row rather than nothing.
  const schemeRows: Array<Partial<AwardScheme>> = [
    { scheme_id: SCHEME_IN_A, club_id: CLUB_A, name: 'British Gymnastics Rise', active: true },
    { scheme_id: SCHEME_IN_B, club_id: CLUB_B, name: 'British Gymnastics Rise', active: true },
  ];
  const levelRows: Array<Partial<AwardLevel>> = [
    { level_id: LEVEL_IN_A, club_id: CLUB_A, scheme_id: SCHEME_IN_A, name: 'Explore 1' },
    { level_id: LEVEL_IN_B, club_id: CLUB_B, scheme_id: SCHEME_IN_B, name: 'Explore 1' },
  ];
  const progressRows: Array<Partial<MemberAwardProgress>> = [
    {
      progress_id: PROGRESS_IN_A,
      club_id: CLUB_A,
      member_id: MEMBER_IN_A,
      level_id: LEVEL_IN_A,
    },
    {
      progress_id: PROGRESS_IN_B,
      club_id: CLUB_B,
      member_id: MEMBER_IN_B,
      level_id: LEVEL_IN_B,
    },
  ];
  const eventRows: Array<Partial<AssessmentEvent>> = [
    { event_id: EVENT_IN_A, club_id: CLUB_A, level_id: LEVEL_IN_A },
    { event_id: 'event-2222-in-club-b', club_id: CLUB_B, level_id: LEVEL_IN_B },
  ];
  const outcomeRows: Array<Partial<AssessmentOutcome>> = [
    { outcome_id: OUTCOME_IN_A, club_id: CLUB_A, event_id: EVENT_IN_A, member_id: MEMBER_IN_A },
  ];

  beforeEach(async () => {
    cls = new FakeClsService();

    const scheme = makeFakeRepo<AwardScheme>(schemeRows, 'scheme_id');
    const level = makeFakeRepo<AwardLevel>(levelRows, 'level_id');
    const progress = makeFakeRepo<MemberAwardProgress>(progressRows, 'progress_id');
    const event = makeFakeRepo<AssessmentEvent>(eventRows, 'event_id');
    const outcome = makeFakeRepo<AssessmentOutcome>(outcomeRows, 'outcome_id');

    schemeCalls = scheme.calls;
    levelCalls = level.calls;
    progressCalls = progress.calls;
    eventCalls = event.calls;
    outcomeCalls = outcome.calls;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwardsRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(AwardScheme), useValue: scheme.repo },
        { provide: getRepositoryToken(AwardLevel), useValue: level.repo },
        { provide: getRepositoryToken(MemberAwardProgress), useValue: progress.repo },
        { provide: getRepositoryToken(AssessmentEvent), useValue: event.repo },
        { provide: getRepositoryToken(AssessmentOutcome), useValue: outcome.repo },
      ],
    }).compile();

    repo = module.get(AwardsRepository);
  });

  describe('scheme reads are scoped to the active club', () => {
    it('findAllSchemes merges club_id with the active filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAllSchemes();

      expect(schemeCalls.find[0]).toEqual({ active: true, club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].scheme_id).toBe(SCHEME_IN_A);
    });

    it('findAllSchemes with includeInactive still scopes by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAllSchemes(true);

      expect(schemeCalls.find[0]).toEqual({ club_id: CLUB_A });
      expect(result.every((row) => row.club_id === CLUB_A)).toBe(true);
    });

    it('findOneScheme returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOneScheme(SCHEME_IN_B);

      expect(schemeCalls.findOne[0]).toEqual({ scheme_id: SCHEME_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });

    it('findSchemeByName never matches an identically named scheme in another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findSchemeByName('British Gymnastics Rise');

      expect(schemeCalls.findOne[0]).toEqual({
        name: 'British Gymnastics Rise',
        club_id: CLUB_A,
      });
      expect(result?.scheme_id).toBe(SCHEME_IN_A);
    });
  });

  describe('scheme writes stamp and scope club_id', () => {
    it('createScheme stamps the context club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createScheme({ name: 'Club badges' } as CreateAwardSchemeDto);

      expect(schemeCalls.saved[0]).toMatchObject({ name: 'Club badges', club_id: CLUB_A });
    });

    it('createScheme overrides a supplied club_id with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createScheme({
        name: 'Club badges',
        club_id: CLUB_B,
      } as CreateAwardSchemeDto);

      expect(schemeCalls.saved[0]).toMatchObject({ club_id: CLUB_A });
      expect(schemeCalls.saved[0].club_id).not.toBe(CLUB_B);
    });

    it('updateScheme scopes the affected-row predicate and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateScheme(SCHEME_IN_A, {
        name: 'Renamed',
        club_id: CLUB_B,
      } as ObjectLiteral);

      expect(schemeCalls.update[0].criteria).toEqual({
        scheme_id: SCHEME_IN_A,
        club_id: CLUB_A,
      });
      expect(schemeCalls.update[0].partial).not.toHaveProperty('club_id');
      expect(schemeCalls.update[0].partial).toMatchObject({ name: 'Renamed' });
    });

    it('removeScheme includes club_id in the delete criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.removeScheme(SCHEME_IN_B);

      expect(schemeCalls.delete[0]).toEqual({ scheme_id: SCHEME_IN_B, club_id: CLUB_A });
    });
  });

  describe('level reads and writes are scoped to the active club', () => {
    it('findLevelsByScheme merges club_id with the scheme filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findLevelsByScheme(SCHEME_IN_A);

      expect(levelCalls.find[0]).toEqual({ scheme_id: SCHEME_IN_A, club_id: CLUB_A });
      expect(result).toHaveLength(1);
    });

    it('findLevelsByScheme returns nothing for another club scheme id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findLevelsByScheme(SCHEME_IN_B);

      expect(levelCalls.find[0]).toEqual({ scheme_id: SCHEME_IN_B, club_id: CLUB_A });
      expect(result).toHaveLength(0);
    });

    it('findOneLevel returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOneLevel(LEVEL_IN_B);

      expect(levelCalls.findOne[0]).toEqual({ level_id: LEVEL_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });

    it('createLevel stamps the context club_id and drops a supplied one', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createLevel({
        scheme_id: SCHEME_IN_A,
        name: 'Explore 2',
        club_id: CLUB_B,
      } as CreateAwardLevelDto);

      expect(levelCalls.saved[0]).toMatchObject({ name: 'Explore 2', club_id: CLUB_A });
      expect(levelCalls.saved[0].club_id).not.toBe(CLUB_B);
    });

    it('updateLevel scopes the affected-row predicate by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateLevel(LEVEL_IN_A, { badge_fee: 4.5 });

      expect(levelCalls.update[0].criteria).toEqual({ level_id: LEVEL_IN_A, club_id: CLUB_A });
    });

    it('removeLevel includes club_id in the delete criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.removeLevel(LEVEL_IN_B);

      expect(levelCalls.delete[0]).toEqual({ level_id: LEVEL_IN_B, club_id: CLUB_A });
    });
  });

  describe('member progress reads never cross the tenant boundary', () => {
    it('findProgressByMember merges club_id with the member filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findProgressByMember(MEMBER_IN_A);

      expect(progressCalls.find[0]).toEqual({ member_id: MEMBER_IN_A, club_id: CLUB_A });
      expect(result).toHaveLength(1);
    });

    it('findProgressByMember returns nothing for a member in another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findProgressByMember(MEMBER_IN_B);

      expect(progressCalls.find[0]).toEqual({ member_id: MEMBER_IN_B, club_id: CLUB_A });
      expect(result).toHaveLength(0);
    });

    it('findProgressByMembers short-circuits on an empty id list', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findProgressByMembers([]);

      expect(result).toEqual([]);
      expect(progressCalls.find).toHaveLength(0);
    });

    it('findProgressByMembers scopes the In(...) query by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findProgressByMembers([MEMBER_IN_A, MEMBER_IN_B]);

      expect(progressCalls.find[0]).toMatchObject({ club_id: CLUB_A });
    });

    it('findOneProgress returns null when the row belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOneProgress(MEMBER_IN_B, LEVEL_IN_B);

      expect(progressCalls.findOne[0]).toEqual({
        member_id: MEMBER_IN_B,
        level_id: LEVEL_IN_B,
        club_id: CLUB_A,
      });
      expect(result).toBeNull();
    });
  });

  describe('member progress writes stamp and scope club_id', () => {
    it('upsertProgress scopes the existing-row lookup and the update', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.upsertProgress(MEMBER_IN_A, LEVEL_IN_A, { notes: 'ready' });

      expect(progressCalls.findOne[0]).toMatchObject({ club_id: CLUB_A });
      expect(progressCalls.update[0].criteria).toEqual({
        progress_id: PROGRESS_IN_A,
        club_id: CLUB_A,
      });
      expect(progressCalls.update[0].partial).not.toHaveProperty('club_id');
    });

    it('upsertProgress creates a fresh stamped row when the match is in another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // The (member, level) pair exists but in CLUB_B, so for CLUB_A it is
      // not-found and a new, correctly stamped row is created instead of
      // mutating CLUB_B's.
      await repo.upsertProgress(MEMBER_IN_B, LEVEL_IN_B, { notes: 'ready' });

      expect(progressCalls.update).toHaveLength(0);
      expect(progressCalls.saved[0]).toMatchObject({
        club_id: CLUB_A,
        member_id: MEMBER_IN_B,
        level_id: LEVEL_IN_B,
      });
    });

    it('upsertProgress drops a club_id supplied in the fields', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.upsertProgress(MEMBER_IN_B, LEVEL_IN_B, {
        club_id: CLUB_B,
      } as Partial<MemberAwardProgress>);

      expect(progressCalls.saved[0]).toMatchObject({ club_id: CLUB_A });
      expect(progressCalls.saved[0].club_id).not.toBe(CLUB_B);
    });
  });

  describe('assessment events and outcomes stamp and scope club_id', () => {
    it('createEvent stamps the context club_id and drops a supplied one', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createEvent({
        level_id: LEVEL_IN_A,
        club_id: CLUB_B,
      } as Partial<AssessmentEvent>);

      expect(eventCalls.saved[0]).toMatchObject({ level_id: LEVEL_IN_A, club_id: CLUB_A });
      expect(eventCalls.saved[0].club_id).not.toBe(CLUB_B);
    });

    it('createOutcome stamps the context club_id and drops a supplied one', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createOutcome({
        event_id: EVENT_IN_A,
        member_id: MEMBER_IN_A,
        club_id: CLUB_B,
      } as Partial<AssessmentOutcome>);

      expect(outcomeCalls.saved[0]).toMatchObject({ club_id: CLUB_A });
      expect(outcomeCalls.saved[0].club_id).not.toBe(CLUB_B);
    });

    it('updateOutcomeInvoice scopes the affected-row predicate by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateOutcomeInvoice(OUTCOME_IN_A, 'invoice-1');

      expect(outcomeCalls.update[0].criteria).toEqual({
        outcome_id: OUTCOME_IN_A,
        club_id: CLUB_A,
      });
    });

    it('findEvents scopes the listing by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findEvents();

      expect(eventCalls.find[0]).toEqual({ club_id: CLUB_A });
      expect(result.every((row) => row.club_id === CLUB_A)).toBe(true);
    });

    it('findOneEvent returns null for an event id in another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOneEvent('event-2222-in-club-b');

      expect(eventCalls.findOne[0]).toEqual({
        event_id: 'event-2222-in-club-b',
        club_id: CLUB_A,
      });
      expect(result).toBeNull();
    });
  });
});
