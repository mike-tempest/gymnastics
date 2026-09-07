import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { Discipline } from '@club-manager/shared-types';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { MembersRepository } from './members.repository';
import { Member } from './entities/member.entity';
import { CreateMemberDto } from './dto/create-member.dto';

/**
 * Cross-tenant isolation test for the members module (Group A pilot).
 *
 * This is the reference pattern the other Phase 3 fan-out agents copy. It drives
 * the real MembersRepository through the real TenantScopedHelper /
 * TenantContextService, but fakes ClsService and the TypeORM repository so no
 * live database is needed. The assertions prove the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's id behaves as not-found (null)
 *  - create stamps the context club_id
 *  - a club_id supplied in the input is overridden by the context
 *  - update/delete scope the affected-row predicate by club_id
 *  - listing filters compose inside club scoping and can only narrow it
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

describe('MembersRepository tenant isolation', () => {
  let repo: MembersRepository;
  let cls: FakeClsService;

  // Records of what the fake TypeORM repository was asked to do.
  let findCalls: ObjectLiteral[];
  let findOptionCalls: ObjectLiteral[];
  let findOneCalls: ObjectLiteral[];
  let updateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let deleteCalls: ObjectLiteral[];
  let savedEntities: ObjectLiteral[];

  // A tiny in-memory data set spanning two clubs to prove cross-tenant reads
  // never leak. The fake honours the club_id merged into the where clause.
  const rows: Array<Partial<Member>> = [
    { member_id: MEMBER_IN_A, first_name: 'Alice', club_id: CLUB_A },
    { member_id: MEMBER_IN_B, first_name: 'Bob', club_id: CLUB_B },
  ];

  function matches(row: Partial<Member>, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => row[key as keyof Member] === value);
  }

  /** The `order` passed to the nth recorded find(). */
  function orderOf(index: number): ObjectLiteral {
    return findOptionCalls[index].order as ObjectLiteral;
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    findCalls = [];
    findOptionCalls = [];
    findOneCalls = [];
    updateCalls = [];
    deleteCalls = [];
    savedEntities = [];

    const fakeTypeOrmRepo = {
      find: jest.fn((options: ObjectLiteral) => {
        findCalls.push(options.where);
        findOptionCalls.push(options);
        return Promise.resolve(rows.filter((r) => matches(r, options.where)));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        findOneCalls.push(options.where);
        return Promise.resolve(rows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        savedEntities.push(entity);
        return Promise.resolve({ member_id: 'new-id', ...entity });
      }),
      update: jest.fn((criteria: ObjectLiteral, partial: ObjectLiteral) => {
        updateCalls.push({ criteria, partial });
        return Promise.resolve({ affected: 1 });
      }),
      delete: jest.fn((criteria: ObjectLiteral) => {
        deleteCalls.push(criteria);
        return Promise.resolve({ affected: 1 });
      }),
      count: jest.fn(() => Promise.resolve(1)),
    } as unknown as Repository<Member>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Member), useValue: fakeTypeOrmRepo },
      ],
    }).compile();

    repo = module.get(MembersRepository);
  });

  describe('reads are scoped to the active club', () => {
    it('findAll injects club_id and returns only this club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAll();

      expect(findCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].member_id).toBe(MEMBER_IN_A);
    });

    it('findByFamilyId merges club_id with the family filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findByFamilyId('family-x');

      expect(findCalls[0]).toEqual({ family_id: 'family-x', club_id: CLUB_A });
    });

    it('findByClubId ignores its argument and uses the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // Even when asked for CLUB_B explicitly, only CLUB_A rows come back.
      const result = await repo.findByClubId(CLUB_B);

      expect(findCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result.every((r) => r.club_id === CLUB_A)).toBe(true);
    });
  });

  describe('the listing filters compose inside club scoping', () => {
    it('a discipline filter narrows within the club rather than replacing it', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findAll({ discipline: Discipline.TRAMPOLINE });

      expect(findCalls[0]).toEqual({
        discipline: Discipline.TRAMPOLINE,
        club_id: CLUB_A,
      });
    });

    it('family, squad and discipline filters all land in one where', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findAll({
        familyId: 'family-x',
        squadId: 'squad-y',
        discipline: Discipline.TEAMGYM,
      });

      // One composed predicate, not a branch per parameter, and club_id is
      // still present alongside every filter.
      expect(findCalls[0]).toEqual({
        family_id: 'family-x',
        squad_id: 'squad-y',
        discipline: Discipline.TEAMGYM,
        club_id: CLUB_A,
      });
    });

    it('omits unset filters instead of matching them against undefined', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findAll({ squadId: 'squad-y' });

      // A `discipline: undefined` key would make TypeORM match on NULL and
      // silently hide every member that has a discipline recorded.
      expect(findCalls[0]).toEqual({ squad_id: 'squad-y', club_id: CLUB_A });
      expect(findCalls[0]).not.toHaveProperty('discipline');
      expect(findCalls[0]).not.toHaveProperty('family_id');
    });

    it('a filter cannot be used to reach another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // MEMBER_IN_B is in CLUB_B. Filtering on the squad it would sit in still
      // returns nothing, because club scoping is applied on top of the filter.
      const result = await repo.findAll({
        squadId: 'squad-in-club-b',
        discipline: Discipline.TUMBLING,
      });

      expect(findCalls[0]).toMatchObject({ club_id: CLUB_A });
      expect(result).toHaveLength(0);
    });

    it('an empty filter set still scopes to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAll({});

      expect(findCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].member_id).toBe(MEMBER_IN_A);
    });

    it('findBySquadId routes through the composed filter and stays scoped', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findBySquadId('squad-y');

      expect(findCalls[0]).toEqual({ squad_id: 'squad-y', club_id: CLUB_A });
    });

    it('keeps a family listing ordered oldest first, and every other by name', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // A family listing is a sibling list, so it reads oldest first. This
      // survives composing another filter on top of the family.
      await repo.findByFamilyId('family-x');
      expect(orderOf(0)).toEqual({ dob: 'ASC' });

      await repo.findAll({ familyId: 'family-x', discipline: Discipline.TUMBLING });
      expect(orderOf(1)).toEqual({ dob: 'ASC' });

      // Any other listing is a roll call and reads by name.
      await repo.findAll({ discipline: Discipline.TUMBLING });
      expect(orderOf(2)).toEqual({ last_name: 'ASC', first_name: 'ASC' });
    });
  });

  describe('findOne behaves as not-found across tenants', () => {
    it('returns the row when it belongs to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOne(MEMBER_IN_A);

      expect(findOneCalls[0]).toEqual({ member_id: MEMBER_IN_A, club_id: CLUB_A });
      expect(result?.member_id).toBe(MEMBER_IN_A);
    });

    it('returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // MEMBER_IN_B exists, but not in CLUB_A, so the scoped lookup is null.
      const result = await repo.findOne(MEMBER_IN_B);

      expect(findOneCalls[0]).toEqual({ member_id: MEMBER_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });
  });

  describe('create stamps the context club_id', () => {
    it('stamps club_id from the active tenant', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateMemberDto = {
        first_name: 'Carol',
        last_name: 'Jones',
        dob: '2012-01-01',
        gender: 'F',
      };

      await repo.create(dto);

      expect(savedEntities[0]).toMatchObject({ first_name: 'Carol', club_id: CLUB_A });
    });

    it('overrides a club_id supplied in the input with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateMemberDto = {
        first_name: 'Mallory',
        last_name: 'Evil',
        dob: '2012-01-01',
        gender: 'F',
        // Attacker tries to plant a row in another club.
        club_id: CLUB_B,
      };

      await repo.create(dto);

      // The injected club_id wins; the supplied CLUB_B is discarded.
      expect(savedEntities[0]).toMatchObject({ club_id: CLUB_A });
      expect(savedEntities[0].club_id).not.toBe(CLUB_B);
    });
  });

  describe('update and delete scope the affected-row predicate by club_id', () => {
    it('update includes club_id in the criteria and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.update(MEMBER_IN_A, {
        first_name: 'Renamed',
        club_id: CLUB_B,
      } as CreateMemberDto);

      expect(updateCalls[0].criteria).toEqual({ member_id: MEMBER_IN_A, club_id: CLUB_A });
      expect(updateCalls[0].partial).not.toHaveProperty('club_id');
      expect(updateCalls[0].partial).toMatchObject({ first_name: 'Renamed' });
    });

    it('delete includes club_id in the criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.remove(MEMBER_IN_A);

      expect(deleteCalls[0]).toEqual({ member_id: MEMBER_IN_A, club_id: CLUB_A });
    });
  });
});
