import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { ApiKeyScope } from '@club-manager/shared-types';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { MembersRepository } from '../members/members.repository';
import { Member } from '../members/entities/member.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { generateApiKey, hashApiKeySecret } from './api-key-crypto';

/**
 * Cross-tenant isolation test for the read API keys module (TEM-32).
 *
 * This is the security-critical claim of the whole ticket: a key issued to
 * one club must never read another club's data. The test proves it end to
 * end rather than by inspection. It drives the real ApiKeyGuard against the
 * real ApiKeysService, then takes the CLS context the guard established and
 * runs the real MembersRepository through the real TenantScopedHelper against
 * a two-club data set. If the guard ever set the wrong club, or set nothing
 * at all, the member reads below would return the wrong rows and fail.
 *
 * Modelled on wellbeing.tenant-isolation.spec.ts: ClsService and the TypeORM
 * repositories are faked so no live database is needed, and the fakes honour
 * whatever `where` they are handed so a missing club_id filter shows up as
 * leaked rows rather than passing silently.
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
const KEY_ID_IN_A = 'key-1111-in-club-a';
const KEY_ID_IN_B = 'key-2222-in-club-b';

/** Builds an http ExecutionContext carrying the given headers. */
function httpContext(request: ObjectLiteral): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('API key tenant isolation', () => {
  let apiKeysService: ApiKeysService;
  let guard: ApiKeyGuard;
  let membersRepository: MembersRepository;
  let cls: FakeClsService;

  // Credentials minted per test run, so no fixed secret ever sits in the repo.
  let keyForClubA: ReturnType<typeof generateApiKey>;
  let keyForClubB: ReturnType<typeof generateApiKey>;
  let revokedKeyForClubA: ReturnType<typeof generateApiKey>;

  let apiKeyRows: Array<Partial<ApiKey>>;
  let apiKeyFindCalls: ObjectLiteral[];
  let apiKeyUpdateCalls: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  let apiKeySavedEntities: ObjectLiteral[];

  const memberRows: Array<Partial<Member>> = [
    { member_id: MEMBER_IN_A, club_id: CLUB_A, first_name: 'Amelia', last_name: 'Okafor' },
    { member_id: MEMBER_IN_B, club_id: CLUB_B, first_name: 'Rhys', last_name: 'Pritchard' },
  ];

  function matches<T extends ObjectLiteral>(row: Partial<T>, where: ObjectLiteral): boolean {
    return Object.entries(where).every(([key, value]) => {
      // The IsNull() operator used for revoked_at arrives as a FindOperator.
      if (value && typeof value === 'object' && 'type' in value) {
        return row[key as keyof T] === null || row[key as keyof T] === undefined;
      }
      return row[key as keyof T] === value;
    });
  }

  beforeEach(async () => {
    cls = new FakeClsService();
    apiKeyFindCalls = [];
    apiKeyUpdateCalls = [];
    apiKeySavedEntities = [];

    keyForClubA = generateApiKey();
    keyForClubB = generateApiKey();
    revokedKeyForClubA = generateApiKey();

    apiKeyRows = [
      {
        api_key_id: KEY_ID_IN_A,
        club_id: CLUB_A,
        key_prefix: keyForClubA.prefix,
        key_hash: keyForClubA.hash,
        label: 'Club A finance export',
        scopes: [ApiKeyScope.MEMBERS_READ],
        created_by_user_id: null,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        last_used_at: null,
        revoked_at: null,
      },
      {
        api_key_id: KEY_ID_IN_B,
        club_id: CLUB_B,
        key_prefix: keyForClubB.prefix,
        key_hash: keyForClubB.hash,
        label: 'Club B reporting',
        scopes: [ApiKeyScope.MEMBERS_READ],
        created_by_user_id: null,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        last_used_at: null,
        revoked_at: null,
      },
      {
        api_key_id: 'key-3333-revoked-in-club-a',
        club_id: CLUB_A,
        key_prefix: revokedKeyForClubA.prefix,
        key_hash: revokedKeyForClubA.hash,
        label: 'Club A retired script',
        scopes: [ApiKeyScope.MEMBERS_READ],
        created_by_user_id: null,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        last_used_at: null,
        revoked_at: new Date('2026-02-01T00:00:00.000Z'),
      },
    ];

    const fakeApiKeyRepo = {
      find: jest.fn((options: ObjectLiteral) => {
        apiKeyFindCalls.push(options.where);
        return Promise.resolve(apiKeyRows.filter((r) => matches(r, options.where)));
      }),
      findOne: jest.fn((options: ObjectLiteral) => {
        apiKeyFindCalls.push(options.where);
        return Promise.resolve(apiKeyRows.find((r) => matches(r, options.where)) ?? null);
      }),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => {
        apiKeySavedEntities.push(entity);
        return Promise.resolve({
          api_key_id: entity.api_key_id ?? 'new-key-id',
          created_at: entity.created_at ?? new Date('2026-03-01T00:00:00.000Z'),
          ...entity,
        });
      }),
      update: jest.fn((criteria: ObjectLiteral, partial: ObjectLiteral) => {
        apiKeyUpdateCalls.push({ criteria, partial });
        return Promise.resolve({ affected: 1 });
      }),
    } as unknown as Repository<ApiKey>;

    const fakeMemberRepo = {
      find: jest.fn((options: ObjectLiteral) =>
        Promise.resolve(memberRows.filter((r) => matches(r, options.where))),
      ),
      findOne: jest.fn((options: ObjectLiteral) =>
        Promise.resolve(memberRows.find((r) => matches(r, options.where)) ?? null),
      ),
      create: jest.fn((entityLike: ObjectLiteral) => entityLike),
      save: jest.fn((entity: ObjectLiteral) => Promise.resolve(entity)),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      count: jest.fn(() => Promise.resolve(0)),
    } as unknown as Repository<Member>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        ApiKeyGuard,
        MembersRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(ApiKey), useValue: fakeApiKeyRepo },
        { provide: getRepositoryToken(Member), useValue: fakeMemberRepo },
      ],
    }).compile();

    apiKeysService = module.get(ApiKeysService);
    guard = module.get(ApiKeyGuard);
    membersRepository = module.get(MembersRepository);
  });

  describe('a key authenticates only into its own club', () => {
    it('resolves the club that issued the key', async () => {
      const authenticated = await apiKeysService.authenticate(keyForClubA.plaintext);

      expect(authenticated).not.toBeNull();
      expect(authenticated?.club_id).toBe(CLUB_A);
      expect(authenticated?.api_key_id).toBe(KEY_ID_IN_A);
    });

    it('never returns the stored hash to the caller', async () => {
      const authenticated = await apiKeysService.authenticate(keyForClubA.plaintext);

      expect(authenticated).not.toHaveProperty('key_hash');
    });

    it('rejects a secret that does not match the stored digest', async () => {
      // Club A's prefix married to club B's secret must not authenticate.
      const forged = `${keyForClubA.prefix}.${keyForClubB.plaintext.split('.')[1]}`;

      await expect(apiKeysService.authenticate(forged)).resolves.toBeNull();
    });

    it('rejects a revoked key', async () => {
      await expect(apiKeysService.authenticate(revokedKeyForClubA.plaintext)).resolves.toBeNull();
    });

    it('rejects an unknown prefix', async () => {
      await expect(apiKeysService.authenticate(generateApiKey().plaintext)).resolves.toBeNull();
    });

    it('rejects malformed credentials without touching the database', async () => {
      const before = apiKeyFindCalls.length;

      await expect(apiKeysService.authenticate('not-a-key')).resolves.toBeNull();
      await expect(apiKeysService.authenticate('')).resolves.toBeNull();

      expect(apiKeyFindCalls).toHaveLength(before);
    });
  });

  describe('the guard establishes the same tenant context the JWT path does', () => {
    it('writes the key club into CLS and onto the request', async () => {
      const request: ObjectLiteral = {
        method: 'GET',
        headers: { 'x-api-key': keyForClubA.plaintext },
      };

      await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);

      expect(cls.get(CLS_CLUB_ID_KEY)).toBe(CLUB_A);
      expect(request.user).toEqual({ club_id: CLUB_A });
      expect(request.apiKey.club_id).toBe(CLUB_A);
    });

    it('gives the request no user_id and no role, so audit and Roles both skip it', async () => {
      const request: ObjectLiteral = {
        method: 'GET',
        headers: { 'x-api-key': keyForClubA.plaintext },
      };

      await guard.canActivate(httpContext(request));

      expect(request.user.user_id).toBeUndefined();
      expect(request.user.role).toBeUndefined();
    });

    it('rejects a missing key with 401 and sets no tenant context', async () => {
      const request: ObjectLiteral = { method: 'GET', headers: {} };

      await expect(guard.canActivate(httpContext(request))).rejects.toMatchObject({ status: 401 });
      expect(cls.get(CLS_CLUB_ID_KEY)).toBeUndefined();
    });

    it('rejects a revoked key with 401 and sets no tenant context', async () => {
      const request: ObjectLiteral = {
        method: 'GET',
        headers: { 'x-api-key': revokedKeyForClubA.plaintext },
      };

      await expect(guard.canActivate(httpContext(request))).rejects.toMatchObject({ status: 401 });
      expect(cls.get(CLS_CLUB_ID_KEY)).toBeUndefined();
    });

    it('gives the same message for an unknown key as for a wrong secret', async () => {
      const unknown = guard
        .canActivate(
          httpContext({ method: 'GET', headers: { 'x-api-key': generateApiKey().plaintext } }),
        )
        .catch((error: Error) => error.message);
      const wrongSecret = guard
        .canActivate(
          httpContext({
            method: 'GET',
            headers: { 'x-api-key': `${keyForClubA.prefix}.wrong-secret-entirely` },
          }),
        )
        .catch((error: Error) => error.message);

      expect(await unknown).toBe(await wrongSecret);
    });

    it('ignores a repeated header rather than guessing which value to trust', async () => {
      const request: ObjectLiteral = {
        method: 'GET',
        headers: { 'x-api-key': [keyForClubA.plaintext, keyForClubB.plaintext] },
      };

      await expect(guard.canActivate(httpContext(request))).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('data read through a key is confined to that key club', () => {
    it('a club A key reads club A members and not club B members', async () => {
      await guard.canActivate(
        httpContext({ method: 'GET', headers: { 'x-api-key': keyForClubA.plaintext } }),
      );

      const members = await membersRepository.findAll();

      expect(members).toHaveLength(1);
      expect(members[0].member_id).toBe(MEMBER_IN_A);
    });

    it('a club B key reads club B members and not club A members', async () => {
      await guard.canActivate(
        httpContext({ method: 'GET', headers: { 'x-api-key': keyForClubB.plaintext } }),
      );

      const members = await membersRepository.findAll();

      expect(members).toHaveLength(1);
      expect(members[0].member_id).toBe(MEMBER_IN_B);
    });

    it('a club A key looking up a club B member id behaves as not-found', async () => {
      await guard.canActivate(
        httpContext({ method: 'GET', headers: { 'x-api-key': keyForClubA.plaintext } }),
      );

      await expect(membersRepository.findOne(MEMBER_IN_B)).resolves.toBeNull();
    });
  });

  describe('key management is scoped to the active club', () => {
    it('findAll returns only the active club keys', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const keys = await apiKeysService.findAll();

      expect(keys.map((key) => key.api_key_id).sort()).toEqual(
        [KEY_ID_IN_A, 'key-3333-revoked-in-club-a'].sort(),
      );
      expect(apiKeyFindCalls[0]).toMatchObject({ club_id: CLUB_A });
    });

    it('findAll never exposes a hash or a plaintext secret', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const keys = await apiKeysService.findAll();

      for (const key of keys) {
        expect(key).not.toHaveProperty('key_hash');
        expect(key).not.toHaveProperty('plaintext_key');
      }
    });

    it('create stamps the active club and stores a hash, never the secret', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const created = await apiKeysService.create(
        { label: 'New integration', scopes: [ApiKeyScope.MEMBERS_READ] },
        'user-in-club-a',
      );

      expect(apiKeySavedEntities[0]).toMatchObject({ club_id: CLUB_A });
      // The row carries a digest of the secret half, not the credential.
      const [, secret] = created.plaintext_key.split('.');
      expect(apiKeySavedEntities[0].key_hash).toBe(hashApiKeySecret(secret));
      expect(apiKeySavedEntities[0].key_hash).not.toBe(secret);
      expect(JSON.stringify(apiKeySavedEntities[0])).not.toContain(secret);
    });

    it('create returns a credential that authenticates into the creating club only', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const created = await apiKeysService.create(
        { label: 'New integration', scopes: [ApiKeyScope.MEMBERS_READ] },
        'user-in-club-a',
      );

      // Register the saved row so the lookup can find it, as a real insert would.
      apiKeyRows.push({
        ...(apiKeySavedEntities[0] as Partial<ApiKey>),
        api_key_id: created.api_key.api_key_id,
      });

      const authenticated = await apiKeysService.authenticate(created.plaintext_key);
      expect(authenticated?.club_id).toBe(CLUB_A);
    });

    it('revoke scopes the lookup by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await apiKeysService.revoke(KEY_ID_IN_A);

      expect(apiKeyFindCalls[0]).toEqual({ api_key_id: KEY_ID_IN_A, club_id: CLUB_A });
      expect(apiKeySavedEntities[0].revoked_at).toBeInstanceOf(Date);
    });

    it('revoking another club key is not-found, never forbidden', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await expect(apiKeysService.revoke(KEY_ID_IN_B)).rejects.toMatchObject({ status: 404 });
      expect(apiKeySavedEntities).toHaveLength(0);
    });

    it('revoking twice keeps the original timestamp', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await apiKeysService.revoke('key-3333-revoked-in-club-a');

      expect(result.revoked_at).toBe(new Date('2026-02-01T00:00:00.000Z').toISOString());
      expect(apiKeySavedEntities).toHaveLength(0);
    });

    it('a revoked key stops authenticating immediately, with no cache in the way', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      // Works before revocation.
      await expect(apiKeysService.authenticate(keyForClubA.plaintext)).resolves.not.toBeNull();

      await apiKeysService.revoke(KEY_ID_IN_A);
      // Reflect the save in the backing rows, as a real update would.
      const row = apiKeyRows.find((r) => r.api_key_id === KEY_ID_IN_A);
      if (row) {
        row.revoked_at = new Date();
      }

      await expect(apiKeysService.authenticate(keyForClubA.plaintext)).resolves.toBeNull();
    });
  });

  describe('last_used_at is recorded off the request path', () => {
    it('records first use without the caller waiting on the write', async () => {
      await apiKeysService.authenticate(keyForClubA.plaintext);

      expect(apiKeyUpdateCalls).toHaveLength(1);
      expect(apiKeyUpdateCalls[0].criteria).toEqual({ api_key_id: KEY_ID_IN_A });
      expect(apiKeyUpdateCalls[0].partial.last_used_at).toBeInstanceOf(Date);
    });

    it('does not write again for a key used moments ago', async () => {
      const row = apiKeyRows.find((r) => r.api_key_id === KEY_ID_IN_A);
      if (row) {
        row.last_used_at = new Date();
      }

      await apiKeysService.authenticate(keyForClubA.plaintext);

      expect(apiKeyUpdateCalls).toHaveLength(0);
    });
  });
});
