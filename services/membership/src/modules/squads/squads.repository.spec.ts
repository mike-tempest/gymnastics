import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { Discipline, SquadType } from '@club-manager/shared-types';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { SquadsRepository } from './squads.repository';
import { Squad } from './entities/squad.entity';
import { Member } from '../members/entities/member.entity';

/**
 * Covers the squad listing filters and the statistics read, driving the real
 * SquadsRepository through the real TenantScopedHelper with a faked TypeORM
 * repository. Follows the pattern in members.tenant-isolation.spec.ts.
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

describe('SquadsRepository listing and statistics', () => {
  let repo: SquadsRepository;
  let cls: FakeClsService;
  let findCalls: ObjectLiteral[];

  beforeEach(async () => {
    cls = new FakeClsService();
    findCalls = [];

    const fakeSquadRepo = {
      find: jest.fn((options: ObjectLiteral) => {
        findCalls.push(options);
        return Promise.resolve([]);
      }),
      findOne: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => Promise.resolve(entity)),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      count: jest.fn(() => Promise.resolve(0)),
    } as unknown as Repository<Squad>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquadsRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Squad), useValue: fakeSquadRepo },
        { provide: getRepositoryToken(Member), useValue: {} },
      ],
    }).compile();

    repo = module.get(SquadsRepository);
    cls.set(CLS_CLUB_ID_KEY, CLUB_A);
  });

  describe('findAll filters', () => {
    it('composes type and discipline inside club scoping', async () => {
      await repo.findAll({ type: SquadType.RECREATIONAL, discipline: Discipline.TRAMPOLINE });

      expect(findCalls[0].where).toEqual({
        squad_type: SquadType.RECREATIONAL,
        discipline: Discipline.TRAMPOLINE,
        club_id: CLUB_A,
      });
    });

    it('omits unset filters instead of matching them against undefined', async () => {
      await repo.findAll({ type: SquadType.COMPETITIVE });

      // A `discipline: undefined` key would make TypeORM match on NULL and
      // hide every squad that has a discipline recorded.
      expect(findCalls[0].where).toEqual({
        squad_type: SquadType.COMPETITIVE,
        club_id: CLUB_A,
      });
      expect(findCalls[0].where).not.toHaveProperty('discipline');
    });

    it('scopes to the active club when no filters are given', async () => {
      await repo.findAll();

      expect(findCalls[0].where).toEqual({ club_id: CLUB_A });
    });
  });

  describe('findAllClassifications', () => {
    it('selects the primary key so rows are not folded into one entity', async () => {
      await repo.findAllClassifications();

      // TypeORM groups raw rows by the primary-key alias when hydrating
      // entities. Without squad_id in an explicit select, every row keys on
      // undefined and the whole club collapses to a single squad, making the
      // statistics report 1 no matter how many squads exist.
      expect(findCalls[0].select).toContain('squad_id');
      expect(findCalls[0].select).toEqual(
        expect.arrayContaining(['squad_id', 'squad_type', 'discipline']),
      );
    });

    it('stays scoped to the active club', async () => {
      await repo.findAllClassifications();

      expect(findCalls[0].where).toEqual({ club_id: CLUB_A });
    });
  });

  describe('findAllNames', () => {
    it('also selects the primary key, for the same grouping reason', async () => {
      await repo.findAllNames();

      expect(findCalls[0].select).toContain('squad_id');
    });
  });
});
