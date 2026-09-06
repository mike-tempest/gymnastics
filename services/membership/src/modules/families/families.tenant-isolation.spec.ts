import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { FamiliesRepository } from './families.repository';
import { Family } from './entities/family.entity';
import { FamilyInvite } from './entities/family-invite.entity';
import { CreateFamilyDto } from './dto/create-family.dto';

/**
 * Cross-tenant isolation test for the families module (Group B).
 *
 * Modelled on src/modules/members/members.tenant-isolation.spec.ts. It drives
 * the real FamiliesRepository through the real TenantScopedHelper /
 * TenantContextService, faking ClsService and the TypeORM repositories so no live
 * database is needed. It proves the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md, plus the family_invites specifics:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's id behaves as not-found (null)
 *  - create stamps the context club_id and ignores a supplied club_id
 *  - update/delete scope the affected-row predicate by club_id
 *  - createInvite stamps the context club_id
 *  - findInviteByToken does NOT scope by club_id (public/unauthenticated route);
 *    the club is derived from the returned invite row instead
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
const FAMILY_IN_A = 'family-1111-in-club-a';
const FAMILY_IN_B = 'family-2222-in-club-b';
const INVITE_TOKEN_A = 'token-for-an-invite-in-club-a';

describe('FamiliesRepository tenant isolation', () => {
  let repo: FamiliesRepository;
  let cls: FakeClsService;

  // Records of what the fake TypeORM repositories were asked to do.
  let findCalls: ObjectLiteral[];
  let findOneCalls: ObjectLiteral[];
  let updateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let deleteCalls: ObjectLiteral[];
  let savedEntities: ObjectLiteral[];

  let inviteFindOneCalls: ObjectLiteral[];
  let savedInvites: ObjectLiteral[];
  let inviteDeleteCalls: unknown[];

  const families: Array<Partial<Family>> = [
    { family_id: FAMILY_IN_A, family_name: 'Alpha', club_id: CLUB_A },
    { family_id: FAMILY_IN_B, family_name: 'Beta', club_id: CLUB_B },
  ];

  const invites: Array<Partial<FamilyInvite>> = [
    {
      invite_id: 'invite-in-a',
      token: INVITE_TOKEN_A,
      family_id: FAMILY_IN_A,
      club_id: CLUB_A,
    },
  ];

  function matches(row: ObjectLiteral, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => {
      // The token lookup uses a MoreThan(date) on expires_at; ignore non-scalar
      // operator objects for this in-memory fake and match on plain fields only.
      if (value !== null && typeof value === 'object') {
        return true;
      }
      return row[key] === value;
    });
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    findCalls = [];
    findOneCalls = [];
    updateCalls = [];
    deleteCalls = [];
    savedEntities = [];
    inviteFindOneCalls = [];
    savedInvites = [];
    inviteDeleteCalls = [];

    const fakeFamilyRepo = {
      find: jest.fn((options: ObjectLiteral) => {
        findCalls.push(options.where);
        return Promise.resolve(families.filter((r) => matches(r, options.where)));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        findOneCalls.push(options.where);
        return Promise.resolve(families.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        savedEntities.push(entity);
        return Promise.resolve({ family_id: 'new-id', ...entity });
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
    } as unknown as Repository<Family>;

    const fakeInviteRepo = {
      findOne: jest.fn((options: ObjectLiteral) => {
        inviteFindOneCalls.push(options.where);
        return Promise.resolve(invites.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        savedInvites.push(entity);
        return Promise.resolve({ invite_id: 'new-invite-id', ...entity });
      }),
      delete: jest.fn((criteria: unknown) => {
        inviteDeleteCalls.push(criteria);
        return Promise.resolve({ affected: 1 });
      }),
    } as unknown as Repository<FamilyInvite>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamiliesRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Family), useValue: fakeFamilyRepo },
        { provide: getRepositoryToken(FamilyInvite), useValue: fakeInviteRepo },
      ],
    }).compile();

    repo = module.get(FamiliesRepository);
  });

  describe('reads are scoped to the active club', () => {
    it('findAll injects club_id and returns only this club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAll();

      expect(findCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].family_id).toBe(FAMILY_IN_A);
    });
  });

  describe('findOne behaves as not-found across tenants', () => {
    it('returns the row when it belongs to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOne(FAMILY_IN_A);

      expect(findOneCalls[0]).toEqual({ family_id: FAMILY_IN_A, club_id: CLUB_A });
      expect(result?.family_id).toBe(FAMILY_IN_A);
    });

    it('returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // FAMILY_IN_B exists, but not in CLUB_A, so the scoped lookup is null.
      const result = await repo.findOne(FAMILY_IN_B);

      expect(findOneCalls[0]).toEqual({ family_id: FAMILY_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });
  });

  describe('create stamps the context club_id', () => {
    it('stamps club_id from the active tenant', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateFamilyDto = {
        family_name: 'The Carols',
        primary_contact_name: 'Carol Jones',
        primary_contact_email: 'carol@example.com',
      };

      await repo.create(dto);

      expect(savedEntities[0]).toMatchObject({ family_name: 'The Carols', club_id: CLUB_A });
    });

    it('overrides a club_id supplied in the input with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto = {
        family_name: 'The Mallorys',
        primary_contact_name: 'Mallory Evil',
        primary_contact_email: 'mallory@example.com',
        // Attacker tries to plant a row in another club.
        club_id: CLUB_B,
      } as CreateFamilyDto;

      await repo.create(dto);

      expect(savedEntities[0]).toMatchObject({ club_id: CLUB_A });
      expect(savedEntities[0].club_id).not.toBe(CLUB_B);
    });
  });

  describe('update and delete scope the affected-row predicate by club_id', () => {
    it('update includes club_id in the criteria and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.update(FAMILY_IN_A, {
        family_name: 'Renamed',
        club_id: CLUB_B,
      } as unknown as CreateFamilyDto);

      expect(updateCalls[0].criteria).toEqual({ family_id: FAMILY_IN_A, club_id: CLUB_A });
      expect(updateCalls[0].partial).not.toHaveProperty('club_id');
      expect(updateCalls[0].partial).toMatchObject({ family_name: 'Renamed' });
    });

    it('delete includes club_id in the criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.remove(FAMILY_IN_A);

      expect(deleteCalls[0]).toEqual({ family_id: FAMILY_IN_A, club_id: CLUB_A });
    });
  });

  describe('count is scoped to the active club', () => {
    it('counts only the active club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.count();

      const countMock = (repo as unknown as { repository: { count: jest.Mock } }).repository.count;
      expect(countMock).toHaveBeenCalledWith({ where: { club_id: CLUB_A } });
    });
  });

  describe('family invites', () => {
    it('createInvite stamps the context club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createInvite(FAMILY_IN_A, 'a-new-token', new Date(Date.now() + 1000));

      expect(savedInvites[0]).toMatchObject({
        family_id: FAMILY_IN_A,
        token: 'a-new-token',
        club_id: CLUB_A,
      });
    });

    it('findInviteByToken does NOT scope by club_id (public route) and resolves the invite', async () => {
      // No tenant context is set: this mirrors the public, unauthenticated
      // invite accept/verify routes. The lookup must still resolve by token.
      const result = await repo.findInviteByToken(INVITE_TOKEN_A);

      // The where clause carries only token + expires_at, never club_id.
      expect(inviteFindOneCalls[0]).toHaveProperty('token', INVITE_TOKEN_A);
      expect(inviteFindOneCalls[0]).not.toHaveProperty('club_id');
      expect(result?.invite_id).toBe('invite-in-a');
      // The club is derived from the invite row itself.
      expect(result?.club_id).toBe(CLUB_A);
    });

    it('removeInvite works without a tenant context (public accept path)', async () => {
      // Reached from the public accept route; must not throw for missing context.
      await expect(repo.removeInvite('invite-in-a')).resolves.toBeUndefined();
      expect(inviteDeleteCalls[0]).toBe('invite-in-a');
    });
  });
});
