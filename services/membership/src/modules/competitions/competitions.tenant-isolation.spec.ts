import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { CompetitionsRepository } from './competitions.repository';
import { Competition } from './entities/competition.entity';
import { CompetitionEntry } from './entities/competition-entry.entity';
import { CompetitionResult } from './entities/competition-result.entity';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { CreateEntryDto } from './dto/create-entry.dto';

/**
 * Cross-tenant isolation test for the competitions module (Group E).
 *
 * Modelled on members.tenant-isolation.spec.ts (the Phase 3 reference). It
 * drives the real CompetitionsRepository through the real TenantScopedHelper /
 * TenantContextService, faking ClsService and the three TypeORM repositories so
 * no live database is needed. It proves the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md across the parent competition AND its
 * child rows (entries, results):
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's id behaves as not-found (null)
 *  - create stamps the context club_id and ignores any supplied club_id
 *  - update/delete scope the affected-row predicate by club_id
 *  - creating a child row for a competition_id in another club is rejected
 *    (the guessed parent id must not be writable)
 */

/** Minimal in-memory fake of ClsService, matching the pilot spec. */
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
const COMP_IN_A = 'comp-1111-in-club-a';
const COMP_IN_B = 'comp-2222-in-club-b';
const ENTRY_IN_A = 'entry-1111-in-club-a';
const ENTRY_IN_B = 'entry-2222-in-club-b';
const RESULT_IN_A = 'result-1111-in-club-a';
const RESULT_IN_B = 'result-2222-in-club-b';
const MEMBER_X = 'member-xxxx';

describe('CompetitionsRepository tenant isolation', () => {
  let repo: CompetitionsRepository;
  let cls: FakeClsService;

  // Records of what each fake TypeORM repository was asked to do.
  let competitionFindCalls: ObjectLiteral[];
  let competitionFindOneCalls: ObjectLiteral[];
  let competitionUpdateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let competitionDeleteCalls: ObjectLiteral[];
  let entryFindCalls: ObjectLiteral[];
  let resultFindCalls: ObjectLiteral[];
  let savedEntries: ObjectLiteral[];
  let savedResults: ObjectLiteral[];
  let savedCompetitions: ObjectLiteral[];

  const competitions: Array<Partial<Competition>> = [
    { competition_id: COMP_IN_A, name: 'Club A Open', club_id: CLUB_A },
    { competition_id: COMP_IN_B, name: 'Club B Open', club_id: CLUB_B },
  ];

  const entries: Array<Partial<CompetitionEntry>> = [
    { entry_id: ENTRY_IN_A, competition_id: COMP_IN_A, member_id: MEMBER_X, club_id: CLUB_A },
    { entry_id: ENTRY_IN_B, competition_id: COMP_IN_B, member_id: MEMBER_X, club_id: CLUB_B },
  ];

  const results: Array<Partial<CompetitionResult>> = [
    { result_id: RESULT_IN_A, competition_id: COMP_IN_A, member_id: MEMBER_X, club_id: CLUB_A },
    { result_id: RESULT_IN_B, competition_id: COMP_IN_B, member_id: MEMBER_X, club_id: CLUB_B },
  ];

  function matches(row: ObjectLiteral, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => row[key] === value);
  }

  function makeFakeRepo<T extends ObjectLiteral>(
    rows: Array<Partial<T>>,
    findCalls: ObjectLiteral[],
    saved: ObjectLiteral[],
    opts: {
      findOneCalls?: ObjectLiteral[];
      updateCalls?: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
      deleteCalls?: ObjectLiteral[];
    } = {},
  ): Repository<T> {
    return {
      find: jest.fn((options: ObjectLiteral) => {
        findCalls.push(options.where);
        return Promise.resolve(rows.filter((r) => matches(r, options.where)));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        opts.findOneCalls?.push(options.where);
        return Promise.resolve(rows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral | ObjectLiteral[]) => {
        if (Array.isArray(entity)) {
          entity.forEach((e) => saved.push(e));
        } else {
          saved.push(entity);
        }
        return Promise.resolve(entity);
      }),
      update: jest.fn((criteria: ObjectLiteral, partial: ObjectLiteral) => {
        opts.updateCalls?.push({ criteria, partial });
        return Promise.resolve({ affected: 1 });
      }),
      delete: jest.fn((criteria: ObjectLiteral) => {
        opts.deleteCalls?.push(criteria);
        return Promise.resolve({ affected: 1 });
      }),
    } as unknown as Repository<T>;
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    competitionFindCalls = [];
    competitionFindOneCalls = [];
    competitionUpdateCalls = [];
    competitionDeleteCalls = [];
    entryFindCalls = [];
    resultFindCalls = [];
    savedEntries = [];
    savedResults = [];
    savedCompetitions = [];

    const competitionRepo = makeFakeRepo<Competition>(
      competitions,
      competitionFindCalls,
      savedCompetitions,
      {
        findOneCalls: competitionFindOneCalls,
        updateCalls: competitionUpdateCalls,
        deleteCalls: competitionDeleteCalls,
      },
    );
    const entryRepo = makeFakeRepo<CompetitionEntry>(entries, entryFindCalls, savedEntries);
    const resultRepo = makeFakeRepo<CompetitionResult>(results, resultFindCalls, savedResults);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompetitionsRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Competition), useValue: competitionRepo },
        { provide: getRepositoryToken(CompetitionEntry), useValue: entryRepo },
        { provide: getRepositoryToken(CompetitionResult), useValue: resultRepo },
      ],
    }).compile();

    repo = module.get(CompetitionsRepository);
  });

  describe('competition reads are scoped to the active club', () => {
    it('findAllCompetitions injects club_id and returns only this club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAllCompetitions();

      expect(competitionFindCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].competition_id).toBe(COMP_IN_A);
    });

    it('findCompetitionById returns the row when it belongs to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findCompetitionById(COMP_IN_A);

      expect(competitionFindOneCalls[0]).toEqual({ competition_id: COMP_IN_A, club_id: CLUB_A });
      expect(result?.competition_id).toBe(COMP_IN_A);
    });

    it('findCompetitionById returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findCompetitionById(COMP_IN_B);

      expect(competitionFindOneCalls[0]).toEqual({ competition_id: COMP_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });
  });

  describe('competition create stamps the context club_id', () => {
    it('stamps club_id from the active tenant', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateCompetitionDto = {
        name: 'New Meet',
        start_date: '2026-06-01',
      };

      await repo.createCompetition(dto);

      expect(savedCompetitions[0]).toMatchObject({ name: 'New Meet', club_id: CLUB_A });
    });

    it('overrides a club_id supplied in the input with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateCompetitionDto = {
        name: 'Planted Meet',
        start_date: '2026-06-01',
        // Attacker tries to plant a row in another club.
        club_id: CLUB_B,
      };

      await repo.createCompetition(dto);

      expect(savedCompetitions[0]).toMatchObject({ club_id: CLUB_A });
      expect(savedCompetitions[0].club_id).not.toBe(CLUB_B);
    });
  });

  describe('competition update/delete scope the affected-row predicate by club_id', () => {
    it('update includes club_id in the criteria and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateCompetition(COMP_IN_A, {
        name: 'Renamed',
        club_id: CLUB_B,
      } as CreateCompetitionDto);

      expect(competitionUpdateCalls[0].criteria).toEqual({
        competition_id: COMP_IN_A,
        club_id: CLUB_A,
      });
      expect(competitionUpdateCalls[0].partial).not.toHaveProperty('club_id');
      expect(competitionUpdateCalls[0].partial).toMatchObject({ name: 'Renamed' });
    });

    it('delete includes club_id in the criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.removeCompetition(COMP_IN_A);

      expect(competitionDeleteCalls[0]).toEqual({
        competition_id: COMP_IN_A,
        club_id: CLUB_A,
      });
    });
  });

  describe('entry reads are scoped to the active club', () => {
    it('findEntriesByCompetition merges club_id with the competition filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findEntriesByCompetition(COMP_IN_A);

      expect(entryFindCalls[0]).toEqual({ competition_id: COMP_IN_A, club_id: CLUB_A });
    });

    it('findEntriesByMember never returns another club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findEntriesByMember(MEMBER_X);

      expect(entryFindCalls[0]).toEqual({ member_id: MEMBER_X, club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].entry_id).toBe(ENTRY_IN_A);
    });
  });

  describe('entry creates require the parent competition to be in the caller club', () => {
    it('stamps the parent club_id when the competition is in the caller club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateEntryDto = { member_id: MEMBER_X, distance: 50, stroke: 'Freestyle' };

      await repo.createEntry(COMP_IN_A, dto);

      expect(savedEntries[0]).toMatchObject({
        competition_id: COMP_IN_A,
        member_id: MEMBER_X,
        club_id: CLUB_A,
      });
    });

    it('rejects an entry for a competition_id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateEntryDto = { member_id: MEMBER_X, distance: 50, stroke: 'Freestyle' };

      // COMP_IN_B exists, but not in CLUB_A, so the parent guard fails.
      await expect(repo.createEntry(COMP_IN_B, dto)).rejects.toThrow(NotFoundException);
      expect(savedEntries).toHaveLength(0);
    });

    it('createEntries rejects a cross-club parent and writes nothing', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dtos: CreateEntryDto[] = [{ member_id: MEMBER_X, distance: 50, stroke: 'Freestyle' }];

      await expect(repo.createEntries(COMP_IN_B, dtos)).rejects.toThrow(NotFoundException);
      expect(savedEntries).toHaveLength(0);
    });

    it('createEntries stamps the parent club_id for an in-club competition', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dtos: CreateEntryDto[] = [
        { member_id: MEMBER_X, distance: 50, stroke: 'Freestyle' },
        { member_id: MEMBER_X, distance: 100, stroke: 'Backstroke' },
      ];

      await repo.createEntries(COMP_IN_A, dtos);

      expect(savedEntries).toHaveLength(2);
      expect(savedEntries.every((e) => e.club_id === CLUB_A)).toBe(true);
    });
  });

  describe('result reads are scoped to the active club', () => {
    it('findResultsByCompetition merges club_id with the competition filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findResultsByCompetition(COMP_IN_A);

      expect(resultFindCalls[0]).toEqual({ competition_id: COMP_IN_A, club_id: CLUB_A });
    });

    it('findResultsByMember never returns another club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findResultsByMember(MEMBER_X);

      expect(resultFindCalls[0]).toEqual({ member_id: MEMBER_X, club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].result_id).toBe(RESULT_IN_A);
    });
  });

  describe('result creates require the parent competition to be in the caller club', () => {
    it('stamps the parent club_id when the competition is in the caller club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createResult({
        competition_id: COMP_IN_A,
        member_id: MEMBER_X,
        distance: 50,
        stroke: 'Freestyle',
        time: 30.5,
      });

      expect(savedResults[0]).toMatchObject({ competition_id: COMP_IN_A, club_id: CLUB_A });
    });

    it('overrides a club_id supplied in the result payload with the parent club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createResult({
        competition_id: COMP_IN_A,
        member_id: MEMBER_X,
        distance: 50,
        stroke: 'Freestyle',
        time: 30.5,
        // Attacker-supplied club_id must be discarded in favour of the parent.
        club_id: CLUB_B,
      });

      expect(savedResults[0].club_id).toBe(CLUB_A);
      expect(savedResults[0].club_id).not.toBe(CLUB_B);
    });

    it('rejects a result for a competition_id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await expect(
        repo.createResult({
          competition_id: COMP_IN_B,
          member_id: MEMBER_X,
          distance: 50,
          stroke: 'Freestyle',
          time: 30.5,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(savedResults).toHaveLength(0);
    });

    it('createResults rejects a cross-club parent and writes nothing', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await expect(
        repo.createResults([
          {
            competition_id: COMP_IN_B,
            member_id: MEMBER_X,
            distance: 50,
            stroke: 'Freestyle',
            time: 30.5,
          },
        ]),
      ).rejects.toThrow(NotFoundException);
      expect(savedResults).toHaveLength(0);
    });
  });
});
