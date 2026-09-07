import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import {
  Discipline,
  SquadType,
  WaitingListOfferStatus,
  WaitingListStatus,
} from '@club-manager/shared-types';
import { SquadCapacityEvents } from '../../common/capacity/squad-capacity.events';
import { ClubsRepository } from '../clubs/clubs.repository';
import { ClubsService } from '../clubs/clubs.service';
import { EmailService } from '../email/email.service';
import { Squad } from '../squads/entities/squad.entity';
import { SquadsRepository } from '../squads/squads.repository';
import { EnrolmentService } from './enrolment.service';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListOffer } from './entities/waiting-list-offer.entity';
import { WaitingListOffersService } from './waiting-list-offers.service';
import { WaitingListRepository } from './waiting-list.repository';

/**
 * The auto-offer engine (TEM-22). These tests pin the behaviour the product
 * is sold on: a place that opens is offered to the right family without
 * anyone asking, one place is never offered twice, and an offer that runs out
 * of time falls through to the next family immediately.
 */

const CLUB_ID = 'club-1';

function entry(overrides: Partial<WaitingListEntry> = {}): WaitingListEntry {
  return {
    entry_id: 'entry-1',
    club_id: CLUB_ID,
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

function squad(overrides: Partial<Squad> = {}): Squad {
  return {
    squad_id: 'squad-1',
    club_id: CLUB_ID,
    squad_name: 'Trampoline Recreational',
    description: null,
    min_age: 5,
    max_age: 12,
    coach_name: 'Tom Beresford',
    training_times: 'Tuesdays, 5pm to 6pm',
    max_capacity: 10,
    squad_type: SquadType.RECREATIONAL,
    level: null,
    discipline: Discipline.TRAMPOLINE,
    programme_flags: null,
    members: [],
    ...overrides,
  } as unknown as Squad;
}

describe('WaitingListOffersService', () => {
  let service: WaitingListOffersService;

  let waitingList: {
    findSettings: jest.Mock;
    findPendingOffersForSquad: jest.Mock;
    findEntriesByStatuses: jest.Mock;
    findEntryIdsPassedOverForSquad: jest.Mock;
    createOffer: jest.Mock;
    updateEntry: jest.Mock;
    updateOffer: jest.Mock;
    findEntry: jest.Mock;
    findOffer: jest.Mock;
    findLapsedPendingOffers: jest.Mock;
  };
  let squads: { findOne: jest.Mock; findAll: jest.Mock };
  let email: { sendWaitingListOffer: jest.Mock };
  let enrolment: { enrol: jest.Mock };
  let capacityEvents: SquadCapacityEvents;

  beforeEach(async () => {
    waitingList = {
      findSettings: jest.fn().mockResolvedValue(null),
      findPendingOffersForSquad: jest.fn().mockResolvedValue([]),
      findEntriesByStatuses: jest.fn().mockResolvedValue([]),
      findEntryIdsPassedOverForSquad: jest.fn().mockResolvedValue(new Set<string>()),
      createOffer: jest
        .fn()
        .mockImplementation((fields: Partial<WaitingListOffer>) =>
          Promise.resolve({ offer_id: 'offer-new', club_id: CLUB_ID, ...fields }),
        ),
      updateEntry: jest.fn().mockResolvedValue(null),
      updateOffer: jest.fn().mockResolvedValue(null),
      findEntry: jest.fn().mockResolvedValue(null),
      findOffer: jest.fn().mockResolvedValue(null),
      findLapsedPendingOffers: jest.fn().mockResolvedValue([]),
    };
    squads = {
      findOne: jest.fn().mockResolvedValue(squad()),
      findAll: jest.fn().mockResolvedValue([squad()]),
    };
    email = { sendWaitingListOffer: jest.fn().mockResolvedValue(undefined) };
    enrolment = { enrol: jest.fn().mockResolvedValue({ member_id: 'member-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitingListOffersService,
        SquadCapacityEvents,
        { provide: ConfigService, useValue: { get: (_key: string, fallback: string) => fallback } },
        { provide: WaitingListRepository, useValue: waitingList },
        { provide: SquadsRepository, useValue: squads },
        { provide: EmailService, useValue: email },
        {
          provide: ClubsRepository,
          useValue: {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: CLUB_ID, name: 'Kestrel Vale', locale: 'en-GB' }),
          },
        },
        { provide: ClubsService, useValue: { findAll: jest.fn().mockResolvedValue([]) } },
        { provide: EnrolmentService, useValue: enrolment },
        { provide: ClsService, useValue: { run: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    service = module.get(WaitingListOffersService);
    capacityEvents = module.get(SquadCapacityEvents);
  });

  describe('auto-offer when a place opens', () => {
    it('offers the free place to the highest-priority eligible entry', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([
        entry({ entry_id: 'stranger', joined_at: new Date('2025-01-01T00:00:00Z') }),
        entry({ entry_id: 'sibling', is_sibling: true }),
      ]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: 1, members: [] }));

      const offers = await service.autoOfferForSquad('squad-1');

      expect(offers).toHaveLength(1);
      expect(waitingList.createOffer).toHaveBeenCalledTimes(1);
      expect(waitingList.createOffer.mock.calls[0][0]).toMatchObject({ entry_id: 'sibling' });
    });

    it('offers as many places as are actually free, and no more', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([
        entry({ entry_id: 'a' }),
        entry({ entry_id: 'b' }),
        entry({ entry_id: 'c' }),
      ]);
      squads.findOne.mockResolvedValue(
        squad({ max_capacity: 4, members: [{}, {}] as unknown as Squad['members'] }),
      );

      const offers = await service.autoOfferForSquad('squad-1');

      expect(offers).toHaveLength(2);
    });

    it('treats a pending offer as a taken place', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([entry()]);
      waitingList.findPendingOffersForSquad.mockResolvedValue([{ offer_id: 'held' }]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: 1, members: [] }));

      const offers = await service.autoOfferForSquad('squad-1');

      expect(offers).toHaveLength(0);
      expect(waitingList.createOffer).not.toHaveBeenCalled();
    });

    it('does nothing for a squad with no capacity recorded', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([entry()]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: null }));

      expect(await service.autoOfferForSquad('squad-1')).toHaveLength(0);
    });

    it('does nothing when the club has switched auto-offer off', async () => {
      waitingList.findSettings.mockResolvedValue({
        club_id: CLUB_ID,
        auto_offer_enabled: false,
        offer_window_days: 7,
      });
      waitingList.findEntriesByStatuses.mockResolvedValue([entry()]);

      expect(await service.autoOfferForSquad('squad-1')).toHaveLength(0);
      expect(waitingList.createOffer).not.toHaveBeenCalled();
    });

    it('skips entries who are not eligible for this class', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([
        entry({ entry_id: 'too-young', child_dob: new Date('2024-01-01') }),
        entry({ entry_id: 'wrong-discipline', desired_discipline: Discipline.TEAMGYM }),
        entry({ entry_id: 'fits' }),
      ]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: 3, members: [] }));

      const offers = await service.autoOfferForSquad('squad-1');

      expect(offers).toHaveLength(1);
      expect(waitingList.createOffer.mock.calls[0][0]).toMatchObject({ entry_id: 'fits' });
    });

    it('does not ask a family again about a class they already turned down', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([entry({ entry_id: 'declined-before' })]);
      waitingList.findEntryIdsPassedOverForSquad.mockResolvedValue(new Set(['declined-before']));
      squads.findOne.mockResolvedValue(squad({ max_capacity: 5, members: [] }));

      expect(await service.autoOfferForSquad('squad-1')).toHaveLength(0);
    });

    it('marks the entry as offered and emails the family', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([entry()]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: 1, members: [] }));

      await service.autoOfferForSquad('squad-1');

      expect(waitingList.updateEntry).toHaveBeenCalledWith('entry-1', {
        status: WaitingListStatus.OFFERED,
      });
      expect(email.sendWaitingListOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'anita@example.com',
          squadName: 'Trampoline Recreational',
          childName: 'Priya Nandra',
        }),
      );
    });

    it('keeps the offer even when the email fails, so the club can chase it', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([entry()]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: 1, members: [] }));
      email.sendWaitingListOffer.mockRejectedValue(new Error('Resend is down'));

      const offers = await service.autoOfferForSquad('squad-1');

      expect(offers).toHaveLength(1);
    });

    it('gives every offer its own random accept token', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([
        entry({ entry_id: 'a' }),
        entry({ entry_id: 'b' }),
      ]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: 2, members: [] }));

      await service.autoOfferForSquad('squad-1');

      const tokens = waitingList.createOffer.mock.calls.map(
        (call: [Partial<WaitingListOffer>]) => call[0].accept_token,
      );
      expect(tokens[0]).toHaveLength(64);
      expect(tokens[0]).not.toEqual(tokens[1]);
    });
  });

  describe('the capacity signal', () => {
    it('runs an offer pass when a squad says a place may have opened', async () => {
      waitingList.findEntriesByStatuses.mockResolvedValue([entry()]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: 1, members: [] }));

      service.onModuleInit();
      await capacityEvents.emitPlaceMayHaveOpened('squad-1');

      expect(waitingList.createOffer).toHaveBeenCalledTimes(1);
    });
  });

  describe('manual offers, the fallback path', () => {
    it('refuses an entry that is not waiting', async () => {
      waitingList.findEntry.mockResolvedValue(entry({ status: WaitingListStatus.OFFERED }));

      await expect(service.offerManually('entry-1', 'squad-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('still applies the eligibility rules', async () => {
      waitingList.findEntry.mockResolvedValue(entry({ child_dob: new Date('2024-01-01') }));

      await expect(service.offerManually('entry-1', 'squad-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('honours an explicit acceptance window', async () => {
      waitingList.findEntry.mockResolvedValue(entry());
      const before = Date.now();

      await service.offerManually('entry-1', 'squad-1', 3);

      const expiresAt = waitingList.createOffer.mock.calls[0][0].expires_at as Date;
      const days = (expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
      expect(days).toBeGreaterThan(2.9);
      expect(days).toBeLessThan(3.1);
    });

    it('is made even when the squad is already full, because a person asked for it', async () => {
      waitingList.findEntry.mockResolvedValue(entry());
      squads.findOne.mockResolvedValue(
        squad({ max_capacity: 1, members: [{}] as unknown as Squad['members'] }),
      );

      await expect(service.offerManually('entry-1', 'squad-1')).resolves.toBeDefined();
    });
  });

  describe('answering an offer', () => {
    const pendingOffer = {
      offer_id: 'offer-1',
      club_id: CLUB_ID,
      entry_id: 'entry-1',
      squad_id: 'squad-1',
      status: WaitingListOfferStatus.PENDING,
      expires_at: new Date(Date.now() + 60_000),
    } as WaitingListOffer;

    it('accepting enrols the child behind the offer and spends the token', async () => {
      waitingList.findEntry.mockResolvedValue(entry());

      await service.accept(pendingOffer);

      expect(waitingList.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          status: WaitingListOfferStatus.ACCEPTED,
          accept_token: null,
        }),
      );
      expect(enrolment.enrol).toHaveBeenCalledWith(expect.anything(), 'squad-1');
    });

    it('refuses to answer an offer that has already been answered', async () => {
      await expect(
        service.accept({ ...pendingOffer, status: WaitingListOfferStatus.DECLINED }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('declining puts the child back on the list and offers the place on', async () => {
      await service.decline(pendingOffer, 'Clashes with school');

      expect(waitingList.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          status: WaitingListOfferStatus.DECLINED,
          decline_reason: 'Clashes with school',
        }),
      );
      expect(waitingList.updateEntry).toHaveBeenCalledWith('entry-1', {
        status: WaitingListStatus.WAITING,
      });
      // The refill pass ran against the squad that just freed up.
      expect(waitingList.findPendingOffersForSquad).toHaveBeenCalledWith('squad-1');
    });

    it('withdrawing can leave the entry alone when the caller has already decided', async () => {
      waitingList.findOffer.mockResolvedValue(pendingOffer);

      await service.withdraw('offer-1', false);

      expect(waitingList.updateEntry).not.toHaveBeenCalled();
      expect(waitingList.findPendingOffersForSquad).toHaveBeenCalledWith('squad-1');
    });
  });

  describe('time-boxed acceptance', () => {
    it('lapses an overdue offer and immediately offers the place to the next family', async () => {
      waitingList.findLapsedPendingOffers.mockResolvedValue([
        {
          offer_id: 'offer-old',
          club_id: CLUB_ID,
          entry_id: 'entry-slow',
          squad_id: 'squad-1',
          status: WaitingListOfferStatus.PENDING,
          expires_at: new Date('2026-01-01T00:00:00Z'),
        } as WaitingListOffer,
      ]);
      waitingList.findEntriesByStatuses.mockResolvedValue([entry({ entry_id: 'entry-next' })]);
      squads.findOne.mockResolvedValue(squad({ max_capacity: 1, members: [] }));

      const expired = await service.expireLapsedOffers(new Date('2026-09-07T00:00:00Z'));

      expect(expired).toBe(1);
      expect(waitingList.updateOffer).toHaveBeenCalledWith(
        'offer-old',
        expect.objectContaining({ status: WaitingListOfferStatus.EXPIRED, accept_token: null }),
      );
      // The child who did not answer stays on the list.
      expect(waitingList.updateEntry).toHaveBeenCalledWith('entry-slow', {
        status: WaitingListStatus.WAITING,
      });
      // And the place went straight to the next family.
      expect(waitingList.createOffer).toHaveBeenCalledWith(
        expect.objectContaining({ entry_id: 'entry-next' }),
      );
    });
  });

  describe('settings', () => {
    it('defaults to auto-offer on with a seven day window', async () => {
      expect(await service.resolveSettings()).toEqual({
        auto_offer_enabled: true,
        offer_window_days: 7,
      });
    });

    it('uses the club window when one is stored', async () => {
      waitingList.findSettings.mockResolvedValue({
        club_id: CLUB_ID,
        auto_offer_enabled: true,
        offer_window_days: 14,
      });

      expect((await service.resolveSettings()).offer_window_days).toBe(14);
    });
  });
});
