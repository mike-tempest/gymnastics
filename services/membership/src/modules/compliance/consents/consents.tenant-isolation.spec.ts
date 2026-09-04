import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import {
  CLS_CLUB_ID_KEY,
  TenantContextService,
} from '../../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { ConsentsRepository } from './consents.repository';
import { Consent, ConsentStatus, ConsentType } from './entities/consent.entity';
import { CreateConsentDto } from './dto/create-consent.dto';

/**
 * Cross-tenant isolation test for the consents repository (Group F, compliance).
 *
 * Modelled on src/modules/swimmers/swimmers.tenant-isolation.spec.ts. It drives
 * the real ConsentsRepository through the real TenantScopedHelper /
 * TenantContextService, but fakes ClsService and the TypeORM repository so no
 * live database is needed. The assertions prove the enforcement rule from
 * docs/multi-tenancy/03-enforcement.md:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's id behaves as not-found (null)
 *  - create stamps the context club_id
 *  - a club_id supplied in the input is overridden by the context
 *  - update/revoke/delete scope the affected-row predicate by club_id
 */

/** Minimal in-memory fake of ClsService. */
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
const CONSENT_IN_A = 'consent-1111-in-club-a';
const CONSENT_IN_B = 'consent-2222-in-club-b';

describe('ConsentsRepository tenant isolation', () => {
  let repo: ConsentsRepository;
  let cls: FakeClsService;

  // Records of what the fake TypeORM repository was asked to do.
  let findCalls: ObjectLiteral[];
  let findOneCalls: ObjectLiteral[];
  let updateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let deleteCalls: ObjectLiteral[];
  let countCalls: ObjectLiteral[];
  let savedEntities: ObjectLiteral[];

  // A tiny in-memory data set spanning two clubs to prove cross-tenant reads
  // never leak. The fake honours the club_id merged into the where clause.
  const rows: Array<Partial<Consent>> = [
    {
      consent_id: CONSENT_IN_A,
      swimmer_id: 'swimmer-a',
      consent_type: ConsentType.PHOTOGRAPHY,
      status: ConsentStatus.GRANTED,
      club_id: CLUB_A,
    },
    {
      consent_id: CONSENT_IN_B,
      swimmer_id: 'swimmer-b',
      consent_type: ConsentType.PHOTOGRAPHY,
      status: ConsentStatus.GRANTED,
      club_id: CLUB_B,
    },
  ];

  function matches(row: Partial<Consent>, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => row[key as keyof Consent] === value);
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    findCalls = [];
    findOneCalls = [];
    updateCalls = [];
    deleteCalls = [];
    countCalls = [];
    savedEntities = [];

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
        return Promise.resolve({ consent_id: 'new-id', ...entity });
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
    } as unknown as Repository<Consent>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Consent), useValue: fakeTypeOrmRepo },
      ],
    }).compile();

    repo = module.get(ConsentsRepository);
  });

  describe('reads are scoped to the active club', () => {
    it('findAll injects club_id and returns only this club rows', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findAll();

      expect(findCalls[0]).toEqual({ club_id: CLUB_A });
      expect(result).toHaveLength(1);
      expect(result[0].consent_id).toBe(CONSENT_IN_A);
    });

    it('findBySwimmer merges club_id with the swimmer filter', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findBySwimmer('swimmer-x');

      expect(findCalls[0]).toEqual({ swimmer_id: 'swimmer-x', club_id: CLUB_A });
    });

    it('findBySwimmerAndType merges club_id with both filters', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findBySwimmerAndType('swimmer-a', ConsentType.PHOTOGRAPHY);

      expect(findCalls[0]).toEqual({
        swimmer_id: 'swimmer-a',
        consent_type: ConsentType.PHOTOGRAPHY,
        club_id: CLUB_A,
      });
    });

    it('count scopes by the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const total = await repo.count();

      expect(countCalls[0]).toEqual({ club_id: CLUB_A });
      expect(total).toBe(1);
    });
  });

  describe('findOne behaves as not-found across tenants', () => {
    it('returns the row when it belongs to the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOne(CONSENT_IN_A);

      expect(findOneCalls[0]).toEqual({ consent_id: CONSENT_IN_A, club_id: CLUB_A });
      expect(result?.consent_id).toBe(CONSENT_IN_A);
    });

    it('returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // CONSENT_IN_B exists, but not in CLUB_A, so the scoped lookup is null.
      const result = await repo.findOne(CONSENT_IN_B);

      expect(findOneCalls[0]).toEqual({ consent_id: CONSENT_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });
  });

  describe('create stamps the context club_id', () => {
    it('stamps club_id from the active tenant', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto: CreateConsentDto = {
        swimmer_id: 'swimmer-new',
        consent_type: ConsentType.PHOTOGRAPHY,
        granted_by_user_id: 'parent-1',
      };

      await repo.create(dto);

      expect(savedEntities[0]).toMatchObject({ swimmer_id: 'swimmer-new', club_id: CLUB_A });
    });

    it('overrides a club_id supplied in the input with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const dto = {
        swimmer_id: 'swimmer-new',
        consent_type: ConsentType.PHOTOGRAPHY,
        granted_by_user_id: 'parent-1',
        // Attacker tries to plant a row in another club.
        club_id: CLUB_B,
      } as CreateConsentDto & { club_id: string };

      await repo.create(dto);

      // The injected club_id wins; the supplied CLUB_B is discarded.
      expect(savedEntities[0]).toMatchObject({ club_id: CLUB_A });
      expect(savedEntities[0].club_id).not.toBe(CLUB_B);
    });
  });

  describe('update, revoke and delete scope the affected-row predicate by club_id', () => {
    it('update includes club_id in the criteria and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.update(CONSENT_IN_A, {
        notes: 'Renamed',
        club_id: CLUB_B,
      } as never);

      expect(updateCalls[0].criteria).toEqual({ consent_id: CONSENT_IN_A, club_id: CLUB_A });
      expect(updateCalls[0].partial).not.toHaveProperty('club_id');
      expect(updateCalls[0].partial).toMatchObject({ notes: 'Renamed' });
    });

    it('revokeConsent scopes the affected-row predicate by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.revokeConsent(CONSENT_IN_A, 'revoking-user');

      expect(updateCalls[0].criteria).toEqual({ consent_id: CONSENT_IN_A, club_id: CLUB_A });
      expect(updateCalls[0].partial).toMatchObject({
        status: ConsentStatus.REVOKED,
        revoked_by_user_id: 'revoking-user',
      });
    });

    it('delete includes club_id in the criteria', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.remove(CONSENT_IN_A);

      expect(deleteCalls[0]).toEqual({ consent_id: CONSENT_IN_A, club_id: CLUB_A });
    });
  });
});
