import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { WaitingListStatus } from '@club-manager/shared-types';
import { CLS_CLUB_ID_KEY } from '../../common/tenancy/tenant-context.service';
import { ClubsRepository } from '../clubs/clubs.repository';
import { FamiliesRepository } from '../families/families.repository';
import { MembersRepository } from '../members/members.repository';
import { SquadsRepository } from '../squads/squads.repository';
import { EnrolmentService } from './enrolment.service';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListOffersService } from './waiting-list-offers.service';
import { WaitingListRepository } from './waiting-list.repository';
import { WaitingListService } from './waiting-list.service';

/**
 * The list itself (TEM-22): joining it with no account, where that puts you,
 * and taking a child off it.
 */

const CLUB = { id: 'club-1', name: 'Kestrel Vale', slug: 'kestrel-vale-gymnastics' };

const JOIN = {
  child_first_name: 'Priya',
  child_last_name: 'Nandra',
  child_dob: '2018-03-01',
  child_gender: 'F',
  parent_name: 'Anita Nandra',
  parent_email: 'Anita@Example.com',
};

function entry(overrides: Partial<WaitingListEntry> = {}): WaitingListEntry {
  return {
    entry_id: 'entry-1',
    club_id: CLUB.id,
    child_first_name: 'Priya',
    child_last_name: 'Nandra',
    child_dob: new Date('2018-03-01'),
    child_gender: 'F',
    parent_name: 'Anita Nandra',
    parent_email: 'anita@example.com',
    parent_phone: null,
    desired_discipline: null,
    desired_squad_type: null,
    preferred_squad_id: null,
    notes: null,
    joined_at: new Date('2026-01-01T00:00:00Z'),
    is_existing_member_family: false,
    is_sibling: false,
    priority_boost: 0,
    status: WaitingListStatus.WAITING,
    enrolled_member_id: null,
    withdrawn_reason: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as WaitingListEntry;
}

describe('WaitingListService', () => {
  let service: WaitingListService;

  let repository: {
    findLiveEntryForChild: jest.Mock;
    createEntry: jest.Mock;
    findEntriesByStatuses: jest.Mock;
    findEntries: jest.Mock;
    findEntry: jest.Mock;
    findOffers: jest.Mock;
    findOffersForEntry: jest.Mock;
    findPendingOfferForEntry: jest.Mock;
    updateEntry: jest.Mock;
    countEntriesByStatus: jest.Mock;
    upsertSettings: jest.Mock;
  };
  let offers: {
    autoOfferAcrossClub: jest.Mock;
    withdraw: jest.Mock;
    accept: jest.Mock;
    resolveSettings: jest.Mock;
  };
  let enrolment: { enrol: jest.Mock };
  let families: { findByPrimaryContactEmail: jest.Mock };
  let members: { findByFamilyId: jest.Mock };
  let squads: { findOne: jest.Mock };
  let cls: { set: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    repository = {
      findLiveEntryForChild: jest.fn().mockResolvedValue(null),
      createEntry: jest
        .fn()
        .mockImplementation((fields) => Promise.resolve(entry({ ...fields, entry_id: 'entry-1' }))),
      findEntriesByStatuses: jest.fn().mockResolvedValue([entry()]),
      findEntries: jest.fn().mockResolvedValue([entry()]),
      findEntry: jest.fn().mockResolvedValue(entry()),
      findOffers: jest.fn().mockResolvedValue([]),
      findOffersForEntry: jest.fn().mockResolvedValue([]),
      findPendingOfferForEntry: jest.fn().mockResolvedValue(null),
      updateEntry: jest.fn().mockImplementation((_id, fields) => Promise.resolve(entry(fields))),
      countEntriesByStatus: jest.fn().mockResolvedValue(0),
      upsertSettings: jest.fn().mockResolvedValue({}),
    };
    offers = {
      autoOfferAcrossClub: jest.fn().mockResolvedValue(0),
      withdraw: jest.fn().mockResolvedValue(undefined),
      accept: jest.fn().mockResolvedValue({ member_id: 'member-1' }),
      resolveSettings: jest
        .fn()
        .mockResolvedValue({ auto_offer_enabled: true, offer_window_days: 7 }),
    };
    enrolment = { enrol: jest.fn().mockResolvedValue({ member_id: 'member-1' }) };
    families = { findByPrimaryContactEmail: jest.fn().mockResolvedValue(null) };
    members = { findByFamilyId: jest.fn().mockResolvedValue([]) };
    squads = { findOne: jest.fn().mockResolvedValue(null) };
    cls = { set: jest.fn(), get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitingListService,
        { provide: WaitingListRepository, useValue: repository },
        { provide: WaitingListOffersService, useValue: offers },
        { provide: EnrolmentService, useValue: enrolment },
        {
          provide: ClubsRepository,
          useValue: {
            findBySlug: jest
              .fn()
              .mockImplementation((slug: string) =>
                Promise.resolve(slug === CLUB.slug ? CLUB : null),
              ),
          },
        },
        { provide: FamiliesRepository, useValue: families },
        { provide: MembersRepository, useValue: members },
        { provide: SquadsRepository, useValue: squads },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    service = module.get(WaitingListService);
  });

  describe('joining the list with no account', () => {
    it('adopts the club in the path as the tenant before writing anything', async () => {
      await service.joinByClubSlug(CLUB.slug, JOIN);

      expect(cls.set).toHaveBeenCalledWith(CLS_CLUB_ID_KEY, CLUB.id);
    });

    it('refuses an unknown club slug', async () => {
      await expect(service.joinByClubSlug('not-a-club', JOIN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.createEntry).not.toHaveBeenCalled();
    });

    it('stores the parent email lowercased, so families match later', async () => {
      await service.joinByClubSlug(CLUB.slug, JOIN);

      expect(repository.createEntry.mock.calls[0][0]).toMatchObject({
        parent_email: 'anita@example.com',
      });
    });

    it('tells the family where they are in the queue', async () => {
      repository.findEntriesByStatuses.mockResolvedValue([
        entry({ entry_id: 'ahead', joined_at: new Date('2025-01-01T00:00:00Z') }),
        entry({ entry_id: 'entry-1' }),
      ]);

      const result = await service.joinByClubSlug(CLUB.slug, JOIN);

      expect(result.position).toBe(2);
      expect(result.club_name).toBe('Kestrel Vale');
    });

    it('does not add the same child twice when a parent submits again', async () => {
      repository.findLiveEntryForChild.mockResolvedValue(entry());

      const result = await service.joinByClubSlug(CLUB.slug, JOIN);

      expect(result.already_on_list).toBe(true);
      expect(repository.createEntry).not.toHaveBeenCalled();
    });

    it('gives an existing club family priority without being asked', async () => {
      families.findByPrimaryContactEmail.mockResolvedValue({ family_id: 'family-1' });
      members.findByFamilyId.mockResolvedValue([{ member_id: 'sibling-1' }]);

      await service.joinByClubSlug(CLUB.slug, JOIN);

      expect(repository.createEntry.mock.calls[0][0]).toMatchObject({
        is_existing_member_family: true,
        is_sibling: true,
      });
    });

    it('does not give a stranger priority', async () => {
      await service.joinByClubSlug(CLUB.slug, JOIN);

      expect(repository.createEntry.mock.calls[0][0]).toMatchObject({
        is_existing_member_family: false,
        is_sibling: false,
      });
    });

    it('runs an offer pass, in case a place is already going spare', async () => {
      await service.joinByClubSlug(CLUB.slug, JOIN);

      expect(offers.autoOfferAcrossClub).toHaveBeenCalled();
    });

    it('refuses a preferred class that does not belong to the club', async () => {
      await expect(
        service.joinByClubSlug(CLUB.slug, { ...JOIN, preferred_squad_id: 'someone-elses-squad' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('the admin listing', () => {
    it('numbers positions across the whole live list, not just the filtered rows', async () => {
      repository.findEntriesByStatuses.mockResolvedValue([
        entry({ entry_id: 'ahead', priority_boost: 5 }),
        entry({ entry_id: 'entry-1' }),
      ]);
      repository.findEntries.mockResolvedValue([entry({ entry_id: 'entry-1' })]);

      const rows = await service.list({ status: WaitingListStatus.WAITING });

      expect(rows).toHaveLength(1);
      expect(rows[0].position).toBe(2);
    });
  });

  describe('taking a child off the list', () => {
    it('marks the withdrawal before releasing the offer that was holding a place', async () => {
      const order: string[] = [];
      repository.findPendingOfferForEntry.mockResolvedValue({ offer_id: 'offer-1' });
      repository.updateEntry.mockImplementation((_id, fields) => {
        order.push(`entry:${fields.status}`);
        return Promise.resolve(entry(fields));
      });
      offers.withdraw.mockImplementation(() => {
        order.push('offer:withdrawn');
        return Promise.resolve();
      });

      await service.withdrawEntry('entry-1', 'Moved away');

      expect(order).toEqual(['entry:withdrawn', 'offer:withdrawn']);
      // False: the entry has already been withdrawn and must not be handed
      // back to the waiting pool by the refill pass.
      expect(offers.withdraw).toHaveBeenCalledWith('offer-1', false);
    });

    it('refuses to withdraw a child who is already enrolled', async () => {
      repository.findEntry.mockResolvedValue(entry({ status: WaitingListStatus.ENROLLED }));

      await expect(service.withdrawEntry('entry-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('enrolling straight off the list', () => {
    it('accepts a live offer when it names the same squad', async () => {
      squads.findOne.mockResolvedValue({ squad_id: 'squad-1', squad_name: 'Trampoline' });
      repository.findPendingOfferForEntry.mockResolvedValue({
        offer_id: 'offer-1',
        squad_id: 'squad-1',
      });

      await service.enrolEntry('entry-1', 'squad-1');

      expect(offers.accept).toHaveBeenCalled();
      expect(enrolment.enrol).not.toHaveBeenCalled();
    });

    it('releases an offer for a different squad and enrols into the one asked for', async () => {
      repository.findPendingOfferForEntry.mockResolvedValue({
        offer_id: 'offer-1',
        squad_id: 'another-squad',
      });

      await service.enrolEntry('entry-1', null);

      expect(offers.withdraw).toHaveBeenCalledWith('offer-1', false);
      expect(enrolment.enrol).toHaveBeenCalledWith(expect.anything(), null);
    });

    it('refuses an unknown entry', async () => {
      repository.findEntry.mockResolvedValue(null);

      await expect(service.enrolEntry('nope', null)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('settings', () => {
    it('acts on the backlog as soon as auto-offer is switched back on', async () => {
      await service.updateSettings({ auto_offer_enabled: true });

      expect(repository.upsertSettings).toHaveBeenCalledWith({ auto_offer_enabled: true });
      expect(offers.autoOfferAcrossClub).toHaveBeenCalled();
    });

    it('does not run an offer pass when auto-offer stays off', async () => {
      offers.resolveSettings.mockResolvedValue({
        auto_offer_enabled: false,
        offer_window_days: 7,
      });

      await service.updateSettings({ auto_offer_enabled: false });

      expect(offers.autoOfferAcrossClub).not.toHaveBeenCalled();
    });
  });
});
