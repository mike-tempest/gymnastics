import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { CredentialStatus, CredentialType } from '@club-manager/shared-types';
import {
  CLS_CLUB_ID_KEY,
  TenantContextService,
} from '../../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { CredentialsRepository } from './credentials.repository';
import { Credential } from './entities/credential.entity';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';

/**
 * Cross-tenant isolation test for the credentials module (TEM-30).
 *
 * Modelled on src/modules/wellbeing/wellbeing.tenant-isolation.spec.ts. It
 * drives the real CredentialsRepository through the real TenantScopedHelper /
 * TenantContextService, faking ClsService and the TypeORM repository so no
 * live database is needed. The assertions prove the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's credential id behaves as not-found (null)
 *  - create stamps the context club_id and drops any supplied club_id
 *  - update/delete/status changes scope the affected-row predicate by club_id
 *  - counts are club-scoped, so one club's totals never include another's
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
const USER_IN_A = 'user-1111-in-club-a';
const USER_IN_B = 'user-2222-in-club-b';
const MEMBER_IN_A = 'member-1111-in-club-a';
const CREDENTIAL_IN_A = 'credential-1111-in-club-a';
const CREDENTIAL_IN_B = 'credential-2222-in-club-b';

describe('CredentialsRepository tenant isolation', () => {
  let repo: CredentialsRepository;
  let cls: FakeClsService;

  // Records of what the fake TypeORM repository was asked to do.
  let findCalls: ObjectLiteral[];
  let findOneCalls: ObjectLiteral[];
  let countCalls: ObjectLiteral[];
  let updateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let deleteCalls: ObjectLiteral[];
  let savedEntities: ObjectLiteral[];

  // In-memory rows spanning two clubs to prove cross-tenant reads never leak.
  // The fakes honour the club_id merged into the where clause.
  const rows: Array<Partial<Credential>> = [
    {
      credential_id: CREDENTIAL_IN_A,
      club_id: CLUB_A,
      user_id: USER_IN_A,
      member_id: null,
      credential_type: CredentialType.FIRST_AID,
      reference_number: 'FA-001',
      status: CredentialStatus.VALID,
    },
    {
      credential_id: CREDENTIAL_IN_B,
      club_id: CLUB_B,
      user_id: USER_IN_B,
      member_id: null,
      credential_type: CredentialType.FIRST_AID,
      reference_number: 'FA-001',
      status: CredentialStatus.VALID,
    },
  ];

  function matches(row: Partial<Credential>, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => {
      const actual = row[key as keyof Credential];
      // The expiry/status filters use TypeORM FindOperators, which the fake
      // does not evaluate: only the plain equality keys (club_id above all)
      // decide what the fake returns.
      if (value !== null && typeof value === 'object') return true;
      return actual === value;
    });
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    findCalls = [];
    findOneCalls = [];
    countCalls = [];
    updateCalls = [];
    deleteCalls = [];
    savedEntities = [];

    const fakeRepo = {
      manager: {
        getRepository: () => ({
          findOne: ({ where }: ObjectLiteral) =>
            Promise.resolve(
              [
                { user_id: USER_IN_A, club_id: CLUB_A },
                { user_id: USER_IN_B, club_id: CLUB_B },
                { member_id: MEMBER_IN_A, club_id: CLUB_A },
              ].find((row) =>
                Object.entries(where).every(
                  ([key, value]) => (row as ObjectLiteral)[key] === value,
                ),
              ) ?? null,
            ),
        }),
      },
      find: jest.fn((options: ObjectLiteral) => {
        findCalls.push(options.where ?? {});
        return Promise.resolve(rows.filter((r) => matches(r, options.where ?? {})));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        findOneCalls.push(options.where);
        return Promise.resolve(rows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        savedEntities.push(entity);
        return Promise.resolve({ credential_id: 'new-credential-id', ...entity });
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
        return Promise.resolve(rows.filter((r) => matches(r, options.where)).length);
      }),
    } as unknown as Repository<Credential>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CredentialsRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Credential), useValue: fakeRepo },
      ],
    }).compile();

    repo = module.get(CredentialsRepository);
  });

  describe('reads are scoped to the active club', () => {
    it('findAll filters by the context club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAll();

      expect(findCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].credential_id).toBe(CREDENTIAL_IN_A);
    });

    it('findOne returns the row when it belongs to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOne(CREDENTIAL_IN_A);

      expect(findOneCalls[0]).toEqual({ credential_id: CREDENTIAL_IN_A, club_id: CLUB_A });
      expect(result?.credential_id).toBe(CREDENTIAL_IN_A);
    });

    it('findOne returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOne(CREDENTIAL_IN_B);

      expect(findOneCalls[0]).toEqual({ credential_id: CREDENTIAL_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });

    it('findByUser never returns another club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findByUser(USER_IN_B);

      expect(findCalls[0]).toEqual({ user_id: USER_IN_B, club_id: CLUB_A });
      expect(result).toHaveLength(0);
    });

    it('findByMember merges club_id with the member filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findByMember(MEMBER_IN_A);

      expect(findCalls[0]).toEqual({ member_id: MEMBER_IN_A, club_id: CLUB_A });
    });

    it('findByReference treats the same reference in another club as free', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // CLUB_B holds FA-001 as well. A duplicate check run for CLUB_A must
      // only ever see CLUB_A's own row.
      const result = await repo.findByReference(CredentialType.FIRST_AID, 'FA-001');

      expect(findOneCalls[0]).toEqual({
        credential_type: CredentialType.FIRST_AID,
        reference_number: 'FA-001',
        club_id: CLUB_A,
      });
      expect(result?.credential_id).toBe(CREDENTIAL_IN_A);
    });

    it('findExpiringWithin scopes the expiry sweep by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_B);

      const result = await repo.findExpiringWithin(90);

      expect(findCalls[0]).toMatchObject({ club_id: CLUB_B });
      expect(result.every((row) => row.club_id === CLUB_B)).toBe(true);
    });

    it('count and countByStatus are club-scoped', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const total = await repo.count();
      const valid = await repo.countByStatus(CredentialStatus.VALID);

      expect(countCalls[0]).toEqual({ club_id: CLUB_A });
      expect(countCalls[1]).toEqual({ status: CredentialStatus.VALID, club_id: CLUB_A });
      expect(total).toBe(1);
      expect(valid).toBe(1);
    });
  });

  describe('writes stamp and scope club_id', () => {
    const dto: CreateCredentialDto = {
      user_id: USER_IN_A,
      credential_type: CredentialType.COACHING_QUALIFICATION,
      title: 'UKCC Level 2 Coaching',
      issue_date: '2026-01-01',
    };

    it('create stamps the context club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.create(dto, USER_IN_A);

      expect(savedEntities[0]).toMatchObject({
        user_id: USER_IN_A,
        member_id: null,
        club_id: CLUB_A,
        created_by_user_id: USER_IN_A,
      });
    });

    it('create overrides a supplied club_id with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // Attacker tries to plant a row in another club.
      await repo.create({ ...dto, club_id: CLUB_B } as CreateCredentialDto, USER_IN_A);

      expect(savedEntities[0]).toMatchObject({ club_id: CLUB_A });
      expect(savedEntities[0].club_id).not.toBe(CLUB_B);
    });

    it('rejects a holder from another club before saving', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);
      await expect(repo.create({ ...dto, user_id: USER_IN_B }, USER_IN_A)).rejects.toThrow(
        'Credential holder not found',
      );
      expect(savedEntities).toHaveLength(0);
    });

    it('accepts a gymnast from the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);
      await repo.create({ ...dto, user_id: undefined, member_id: MEMBER_IN_A }, USER_IN_A);
      expect(savedEntities[0]).toMatchObject({ member_id: MEMBER_IN_A, club_id: CLUB_A });
    });

    it('update scopes the affected-row predicate and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.update(CREDENTIAL_IN_A, {
        title: 'Renewed award',
        club_id: CLUB_B,
      } as unknown as UpdateCredentialDto);

      expect(updateCalls[0].criteria).toEqual({
        credential_id: CREDENTIAL_IN_A,
        club_id: CLUB_A,
      });
      expect(updateCalls[0].partial).not.toHaveProperty('club_id');
      expect(updateCalls[0].partial).toMatchObject({ title: 'Renewed award' });
    });

    it('update of another club id changes nothing and reads back as not-found', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.update(CREDENTIAL_IN_B, {
        title: 'Tampered',
      } as UpdateCredentialDto);

      // The predicate carries CLUB_A, so CLUB_B's row matches nothing.
      expect(updateCalls[0].criteria).toEqual({
        credential_id: CREDENTIAL_IN_B,
        club_id: CLUB_A,
      });
      expect(result).toBeNull();
    });

    it('setStatus scopes the affected-row predicate by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.setStatus(CREDENTIAL_IN_A, CredentialStatus.EXPIRING_SOON);

      expect(updateCalls[0].criteria).toEqual({
        credential_id: CREDENTIAL_IN_A,
        club_id: CLUB_A,
      });
      expect(updateCalls[0].partial).toEqual({ status: CredentialStatus.EXPIRING_SOON });
    });

    it('remove includes club_id in the delete criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.remove(CREDENTIAL_IN_A);

      expect(deleteCalls[0]).toEqual({ credential_id: CREDENTIAL_IN_A, club_id: CLUB_A });
    });
  });

  it('throws when no tenant context is established', async () => {
    // No club in CLS: every scoped call must refuse rather than fall back to
    // an unfiltered query.
    await expect(repo.findAll()).rejects.toThrow();
  });
});
