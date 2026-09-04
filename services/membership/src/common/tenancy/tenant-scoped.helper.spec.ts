import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { CLS_CLUB_ID_KEY, TenantContextService } from './tenant-context.service';
import { TenantScopedHelper } from './tenant-scoped.helper';

/**
 * Minimal in-memory fake of ClsService backed by a plain Map, so we can drive
 * TenantContextService / TenantScopedHelper without a real request lifecycle.
 */
class FakeClsService {
  private store = new Map<string, unknown>();

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }
}

const CLUB_ID = 'club-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('TenantScopedHelper', () => {
  let helper: TenantScopedHelper;
  let context: TenantContextService;
  let cls: FakeClsService;

  beforeEach(async () => {
    cls = new FakeClsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantScopedHelper, TenantContextService, { provide: ClsService, useValue: cls }],
    }).compile();

    helper = module.get(TenantScopedHelper);
    context = module.get(TenantContextService);
  });

  /** Build a repo stub that records the args it was called with. */
  function makeRepo<T extends ObjectLiteral>() {
    const calls = { find: undefined as unknown, findOne: undefined as unknown };
    const qb: Record<string, jest.Mock> = {};
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);

    const repo = {
      find: jest.fn((options) => {
        calls.find = options;
        return Promise.resolve([] as T[]);
      }),
      findOne: jest.fn((options) => {
        calls.findOne = options;
        return Promise.resolve(null);
      }),
      createQueryBuilder: jest.fn(() => qb),
    } as unknown as Repository<T>;

    return { repo, calls, qb };
  }

  describe('TenantContextService', () => {
    it('getClubId returns the club_id from CLS', () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_ID);
      expect(context.getClubId()).toBe(CLUB_ID);
    });

    it('getClubId throws when no club is in context', () => {
      expect(() => context.getClubId()).toThrow(InternalServerErrorException);
    });

    it('getClubIdOrNull returns null when no club is in context', () => {
      expect(context.getClubIdOrNull()).toBeNull();
    });

    it('getClubIdOrNull returns the club when present', () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_ID);
      expect(context.getClubIdOrNull()).toBe(CLUB_ID);
    });
  });

  describe('scopedFind', () => {
    it('injects club_id into an object where clause', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_ID);
      const { repo, calls } = makeRepo();

      await helper.scopedFind(repo, { where: { active: true } });

      expect(calls.find).toEqual({ where: { active: true, club_id: CLUB_ID } });
    });

    it('injects club_id when no options are given', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_ID);
      const { repo, calls } = makeRepo();

      await helper.scopedFind(repo);

      expect(calls.find).toEqual({ where: { club_id: CLUB_ID } });
    });

    it('injects club_id into each branch of an array where clause', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_ID);
      const { repo, calls } = makeRepo();

      await helper.scopedFind(repo, { where: [{ active: true }, { active: false }] });

      expect(calls.find).toEqual({
        where: [
          { active: true, club_id: CLUB_ID },
          { active: false, club_id: CLUB_ID },
        ],
      });
    });

    it('throws when no tenant context is set', async () => {
      const { repo } = makeRepo();
      await expect(helper.scopedFind(repo, { where: { active: true } })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('scopedFindOne', () => {
    it('injects club_id into the where clause', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_ID);
      const { repo, calls } = makeRepo();

      await helper.scopedFindOne(repo, { where: { id: 'x' } });

      expect(calls.findOne).toEqual({ where: { id: 'x', club_id: CLUB_ID } });
    });
  });

  describe('scopedQueryBuilder', () => {
    it('adds a club_id where clause using the alias', () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_ID);
      const { repo, qb } = makeRepo();

      helper.scopedQueryBuilder(repo, 's');

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('s');
      expect(qb.where).toHaveBeenCalledWith('s.club_id = :clubId', { clubId: CLUB_ID });
    });

    it('throws when no tenant context is set', () => {
      const { repo } = makeRepo();
      expect(() => helper.scopedQueryBuilder(repo, 's')).toThrow(InternalServerErrorException);
    });
  });

  describe('stampCreate', () => {
    it('sets club_id on the entity-like object', () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_ID);

      const stamped = helper.stampCreate({ name: 'Lane 1' });

      expect(stamped).toEqual({ name: 'Lane 1', club_id: CLUB_ID });
    });

    it('throws when no tenant context is set', () => {
      expect(() => helper.stampCreate({ name: 'Lane 1' })).toThrow(InternalServerErrorException);
    });
  });
});
