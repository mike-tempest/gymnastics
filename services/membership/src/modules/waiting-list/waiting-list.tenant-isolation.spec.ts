import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { ObjectLiteral, Repository } from 'typeorm';
import { WaitingListOfferStatus, WaitingListStatus } from '@club-manager/shared-types';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListOffer } from './entities/waiting-list-offer.entity';
import { WaitingListSettings } from './entities/waiting-list-settings.entity';
import { WaitingListRepository } from './waiting-list.repository';

/**
 * Cross-tenant isolation test for the waiting list module (TEM-22).
 *
 * Modelled on src/modules/awards/awards.tenant-isolation.spec.ts. It drives
 * the real WaitingListRepository through the real TenantScopedHelper /
 * TenantContextService, faking ClsService and the three TypeORM repositories
 * so no live database is needed. The assertions prove the enforcement rule
 * from docs/multi-tenancy/03-enforcement.md:
 *
 *  - reads inject `club_id = getClubId()`
 *  - a findOne for another club's id behaves as not-found (null)
 *  - create stamps the context club_id and drops any supplied club_id
 *  - update scopes the affected-row predicate by club_id
 *
 * It also pins the one deliberate exception, the public offer token lookup,
 * which has to reach across clubs because the parent answering an offer has
 * no account and therefore no tenant context.
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
const ENTRY_IN_A = 'entry-1111-in-club-a';
const ENTRY_IN_B = 'entry-2222-in-club-b';
const OFFER_IN_A = 'offer-1111-in-club-a';
const OFFER_IN_B = 'offer-2222-in-club-b';
const SQUAD_IN_A = 'squad-1111-in-club-a';
const SQUAD_IN_B = 'squad-2222-in-club-b';
const TOKEN_IN_B = 'token-belonging-to-club-b';

interface RepoCalls {
  find: ObjectLiteral[];
  findOne: ObjectLiteral[];
  update: Array<{ criteria: ObjectLiteral; partial: ObjectLiteral }>;
  count: ObjectLiteral[];
  saved: ObjectLiteral[];
}

function matches<T extends ObjectLiteral>(row: Partial<T>, where: ObjectLiteral): boolean {
  return Object.entries(where).every(([key, value]) => row[key as keyof T] === value);
}

function makeFakeRepo<T extends ObjectLiteral>(
  rows: Array<Partial<T>>,
  idField: string,
): { repo: Repository<T>; calls: RepoCalls } {
  const calls: RepoCalls = { find: [], findOne: [], update: [], count: [], saved: [] };

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
    count: jest.fn((options: ObjectLiteral) => {
      calls.count.push(options.where);
      return Promise.resolve(rows.filter((row) => matches(row, options.where)).length);
    }),
  } as unknown as Repository<T>;

  return { repo, calls };
}

describe('WaitingListRepository tenant isolation', () => {
  let repo: WaitingListRepository;
  let cls: FakeClsService;

  let entryCalls: RepoCalls;
  let offerCalls: RepoCalls;
  let settingsCalls: RepoCalls;

  // Data sets spanning two clubs, so a cross-tenant read that leaked would
  // return the other club's row rather than nothing.
  const entryRows: Array<Partial<WaitingListEntry>> = [
    {
      entry_id: ENTRY_IN_A,
      club_id: CLUB_A,
      child_first_name: 'Priya',
      child_last_name: 'Nandra',
      parent_email: 'shared@example.com',
      status: WaitingListStatus.WAITING,
    },
    {
      entry_id: ENTRY_IN_B,
      club_id: CLUB_B,
      child_first_name: 'Priya',
      child_last_name: 'Nandra',
      parent_email: 'shared@example.com',
      status: WaitingListStatus.WAITING,
    },
  ];
  const offerRows: Array<Partial<WaitingListOffer>> = [
    {
      offer_id: OFFER_IN_A,
      club_id: CLUB_A,
      entry_id: ENTRY_IN_A,
      squad_id: SQUAD_IN_A,
      status: WaitingListOfferStatus.PENDING,
      accept_token: 'token-belonging-to-club-a',
    },
    {
      offer_id: OFFER_IN_B,
      club_id: CLUB_B,
      entry_id: ENTRY_IN_B,
      squad_id: SQUAD_IN_B,
      status: WaitingListOfferStatus.PENDING,
      accept_token: TOKEN_IN_B,
    },
  ];
  const settingsRows: Array<Partial<WaitingListSettings>> = [
    { club_id: CLUB_A, auto_offer_enabled: true, offer_window_days: 7 },
    { club_id: CLUB_B, auto_offer_enabled: false, offer_window_days: 21 },
  ];

  beforeEach(async () => {
    cls = new FakeClsService();

    const entries = makeFakeRepo<WaitingListEntry>(entryRows, 'entry_id');
    const offers = makeFakeRepo<WaitingListOffer>(offerRows, 'offer_id');
    const settings = makeFakeRepo<WaitingListSettings>(settingsRows, 'club_id');

    entryCalls = entries.calls;
    offerCalls = offers.calls;
    settingsCalls = settings.calls;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitingListRepository,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(WaitingListEntry), useValue: entries.repo },
        { provide: getRepositoryToken(WaitingListOffer), useValue: offers.repo },
        { provide: getRepositoryToken(WaitingListSettings), useValue: settings.repo },
      ],
    }).compile();

    repo = module.get(WaitingListRepository);
  });

  describe('entry reads are scoped to the active club', () => {
    it('findEntries merges club_id with the supplied filters', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findEntries({ status: WaitingListStatus.WAITING });

      expect(entryCalls.find[0]).toEqual({
        status: WaitingListStatus.WAITING,
        club_id: CLUB_A,
      });
      expect(result).toHaveLength(1);
      expect(result[0].entry_id).toBe(ENTRY_IN_A);
    });

    it('findEntries with no filters still scopes by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findEntries();

      expect(entryCalls.find[0]).toEqual({ club_id: CLUB_A });
      expect(result.every((row) => row.club_id === CLUB_A)).toBe(true);
    });

    it('findEntry returns null for an id that belongs to another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findEntry(ENTRY_IN_B);

      expect(entryCalls.findOne[0]).toEqual({ entry_id: ENTRY_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });

    it('findEntriesByStatuses scopes the In(...) query by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findEntriesByStatuses([WaitingListStatus.WAITING, WaitingListStatus.OFFERED]);

      expect(entryCalls.find[0]).toMatchObject({ club_id: CLUB_A });
    });

    it('findEntriesByStatuses short-circuits on an empty status list', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findEntriesByStatuses([]);

      expect(result).toEqual([]);
      expect(entryCalls.find).toHaveLength(0);
    });

    it('findLiveEntryForChild never matches the same child at another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findLiveEntryForChild(
        'Priya',
        'Nandra',
        '2017-04-02',
        'shared@example.com',
      );

      expect(entryCalls.find[0]).toMatchObject({ club_id: CLUB_A });
      // Only club A's rows were ever a candidate, whatever the name matching
      // then does with them.
      expect(result?.club_id ?? CLUB_A).toBe(CLUB_A);
    });

    it('countEntriesByStatus counts only the active club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const count = await repo.countEntriesByStatus(WaitingListStatus.WAITING);

      expect(entryCalls.count[0]).toEqual({
        status: WaitingListStatus.WAITING,
        club_id: CLUB_A,
      });
      expect(count).toBe(1);
    });
  });

  describe('entry writes stamp and scope club_id', () => {
    it('createEntry stamps the context club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createEntry({ child_first_name: 'Ada' });

      expect(entryCalls.saved[0]).toMatchObject({ child_first_name: 'Ada', club_id: CLUB_A });
    });

    it('createEntry overrides a supplied club_id with the context club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createEntry({ child_first_name: 'Ada', club_id: CLUB_B });

      expect(entryCalls.saved[0]).toMatchObject({ club_id: CLUB_A });
      expect(entryCalls.saved[0].club_id).not.toBe(CLUB_B);
    });

    it('updateEntry scopes the affected-row predicate and drops a supplied club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateEntry(ENTRY_IN_A, {
        status: WaitingListStatus.OFFERED,
        club_id: CLUB_B,
      });

      expect(entryCalls.update[0].criteria).toEqual({
        entry_id: ENTRY_IN_A,
        club_id: CLUB_A,
      });
      expect(entryCalls.update[0].partial).not.toHaveProperty('club_id');
      expect(entryCalls.update[0].partial).toMatchObject({ status: WaitingListStatus.OFFERED });
    });

    it('updateEntry treats an empty body as a no-op rather than a driver error', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateEntry(ENTRY_IN_A, {});

      expect(entryCalls.update).toHaveLength(0);
    });
  });

  describe('offer reads and writes are scoped to the active club', () => {
    it('findOffers scopes the listing by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOffers([WaitingListOfferStatus.PENDING]);

      expect(offerCalls.find[0]).toMatchObject({ club_id: CLUB_A });
      expect(result.every((row) => row.club_id === CLUB_A)).toBe(true);
    });

    it('findOffer returns null for an offer id in another club', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findOffer(OFFER_IN_B);

      expect(offerCalls.findOne[0]).toEqual({ offer_id: OFFER_IN_B, club_id: CLUB_A });
      expect(result).toBeNull();
    });

    it('findPendingOffersForSquad returns nothing for another club squad id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findPendingOffersForSquad(SQUAD_IN_B);

      expect(offerCalls.find[0]).toEqual({
        squad_id: SQUAD_IN_B,
        status: WaitingListOfferStatus.PENDING,
        club_id: CLUB_A,
      });
      expect(result).toHaveLength(0);
    });

    it('findEntryIdsPassedOverForSquad scopes the lookup by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findEntryIdsPassedOverForSquad(SQUAD_IN_A);

      expect(offerCalls.find[0]).toMatchObject({ club_id: CLUB_A, squad_id: SQUAD_IN_A });
    });

    it('createOffer stamps the context club_id and drops a supplied one', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.createOffer({ entry_id: ENTRY_IN_A, squad_id: SQUAD_IN_A, club_id: CLUB_B });

      expect(offerCalls.saved[0]).toMatchObject({ entry_id: ENTRY_IN_A, club_id: CLUB_A });
      expect(offerCalls.saved[0].club_id).not.toBe(CLUB_B);
    });

    it('updateOffer scopes the affected-row predicate by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.updateOffer(OFFER_IN_A, { status: WaitingListOfferStatus.ACCEPTED });

      expect(offerCalls.update[0].criteria).toEqual({
        offer_id: OFFER_IN_A,
        club_id: CLUB_A,
      });
    });

    it('findLapsedPendingOffers scopes the expiry sweep by club_id', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.findLapsedPendingOffers(new Date('2026-09-07T00:00:00Z'));

      expect(offerCalls.find[0]).toMatchObject({
        club_id: CLUB_A,
        status: WaitingListOfferStatus.PENDING,
      });
    });
  });

  describe('the public offer token lookup is the one deliberate exception', () => {
    it('resolves an offer in any club, because the caller has no tenant yet', async () => {
      // No CLS club is set at all: this is the unauthenticated parent
      // following the link in their offer email.
      const result = await repo.findOfferByTokenAcrossClubs(TOKEN_IN_B);

      expect(offerCalls.findOne[0]).toEqual({ accept_token: TOKEN_IN_B });
      expect(result?.offer_id).toBe(OFFER_IN_B);
      expect(result?.club_id).toBe(CLUB_B);
    });

    it('refuses an empty token rather than matching a row with a null token', async () => {
      const result = await repo.findOfferByTokenAcrossClubs('');

      expect(result).toBeNull();
      expect(offerCalls.findOne).toHaveLength(0);
    });
  });

  describe('settings are one row per club', () => {
    it('findSettings reads only the active club row', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      const result = await repo.findSettings();

      expect(settingsCalls.findOne[0]).toEqual({ club_id: CLUB_A });
      expect(result?.offer_window_days).toBe(7);
    });

    it('upsertSettings updates the active club row and never another', async () => {
      cls.set(CLS_CLUB_ID_KEY, CLUB_A);

      await repo.upsertSettings({ offer_window_days: 14, club_id: CLUB_B });

      expect(settingsCalls.update[0].criteria).toEqual({ club_id: CLUB_A });
      expect(settingsCalls.update[0].partial).not.toHaveProperty('club_id');
      expect(settingsCalls.update[0].partial).toEqual({ offer_window_days: 14 });
    });
  });
});
