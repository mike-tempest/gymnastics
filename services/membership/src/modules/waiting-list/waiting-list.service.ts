import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { WaitingListOfferStatus, WaitingListStatus } from '@club-manager/shared-types';
import { CLS_CLUB_ID_KEY } from '../../common/tenancy/tenant-context.service';
import { ClubsRepository } from '../clubs/clubs.repository';
import { FamiliesRepository } from '../families/families.repository';
import { MembersRepository } from '../members/members.repository';
import { SquadsRepository } from '../squads/squads.repository';
import {
  CreateWaitingListEntryDto,
  JoinWaitingListDto,
  UpdateWaitingListEntryDto,
} from './dto/waiting-list-entry.dto';
import { UpdateWaitingListSettingsDto } from './dto/waiting-list-offer.dto';
import { EnrolmentResult, EnrolmentService } from './enrolment.service';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListOffersService } from './waiting-list-offers.service';
import { WaitingListEntryFilters, WaitingListRepository } from './waiting-list.repository';
import { withPositions } from './waiting-list.rules';

/** What the public join page gets back. Deliberately says nothing private. */
export interface JoinWaitingListResult {
  entry_id: string;
  club_name: string;
  /** Where they are in the queue right now, which is what parents ask. */
  position: number;
  /** True when they were already on the list, so a resubmit is not a duplicate. */
  already_on_list: boolean;
}

/** Headline numbers for the dashboard card. */
export interface WaitingListSummary {
  waiting: number;
  offered: number;
  enrolled: number;
  offers_expiring_within_48_hours: number;
  longest_wait_days: number | null;
}

/**
 * The club's own waiting list (TEM-22).
 *
 * Note this is not the `waitlist` module, which is the launch waiting list
 * clubs join to hear about the product. The two have nothing to do with each
 * other and are deliberately kept apart.
 */
@Injectable()
export class WaitingListService {
  private readonly logger = new Logger(WaitingListService.name);

  constructor(
    private readonly repository: WaitingListRepository,
    private readonly offersService: WaitingListOffersService,
    private readonly enrolmentService: EnrolmentService,
    private readonly clubsRepository: ClubsRepository,
    private readonly familiesRepository: FamiliesRepository,
    private readonly membersRepository: MembersRepository,
    private readonly squadsRepository: SquadsRepository,
    private readonly cls: ClsService,
  ) {}

  // --- Public join ---

  /**
   * Joining from the club's public page. No account, no login: the family is
   * only created if and when a place is taken.
   *
   * The request arrives with no tenant context, so the club is resolved from
   * the slug in the path and set as the tenant for the rest of the call. Every
   * query below is club-scoped from that point on.
   */
  async joinByClubSlug(slug: string, dto: JoinWaitingListDto): Promise<JoinWaitingListResult> {
    const club = await this.clubsRepository.findBySlug(slug);
    if (!club) {
      throw new NotFoundException('Club not found');
    }
    this.cls.set(CLS_CLUB_ID_KEY, club.id);

    const email = dto.parent_email.trim().toLowerCase();

    // A parent who submits twice should not end up on the list twice.
    const existing = await this.repository.findLiveEntryForChild(
      dto.child_first_name,
      dto.child_last_name,
      dto.child_dob,
      email,
    );
    if (existing) {
      return {
        entry_id: existing.entry_id,
        club_name: club.name,
        position: await this.positionOf(existing.entry_id),
        already_on_list: true,
      };
    }

    // A preferred squad named by a stranger has to belong to this club.
    if (dto.preferred_squad_id) {
      const squad = await this.squadsRepository.findOne(dto.preferred_squad_id);
      if (!squad) {
        throw new BadRequestException("That class is not one of this club's");
      }
    }

    const priority = await this.derivePriority(email);
    const entry = await this.repository.createEntry({
      child_first_name: dto.child_first_name.trim(),
      child_last_name: dto.child_last_name.trim(),
      child_dob: new Date(dto.child_dob),
      child_gender: dto.child_gender ?? null,
      parent_name: dto.parent_name.trim(),
      parent_email: email,
      parent_phone: dto.parent_phone ?? null,
      desired_discipline: dto.desired_discipline ?? null,
      desired_squad_type: dto.desired_squad_type ?? null,
      preferred_squad_id: dto.preferred_squad_id ?? null,
      notes: dto.notes ?? null,
      joined_at: new Date(),
      status: WaitingListStatus.WAITING,
      ...priority,
    });

    this.logger.log(`New waiting list entry ${entry.entry_id} at ${club.name}`);

    // A place may already be going spare, in which case the family hears back
    // straight away rather than waiting for someone to notice.
    await this.offersService.autoOfferAcrossClub();

    return {
      entry_id: entry.entry_id,
      club_name: club.name,
      position: await this.positionOf(entry.entry_id),
      already_on_list: false,
    };
  }

  /**
   * Priority flags a club would set by hand, worked out from what it already
   * knows. A family already on the books goes ahead of a stranger, and a
   * sibling of a current member ahead of a first child, which is what clubs
   * actually do (docs/05 rule 3).
   */
  private async derivePriority(
    parentEmail: string,
  ): Promise<{ is_existing_member_family: boolean; is_sibling: boolean }> {
    const family = await this.familiesRepository.findByPrimaryContactEmail(parentEmail);
    if (!family) {
      return { is_existing_member_family: false, is_sibling: false };
    }
    const siblings = await this.membersRepository.findByFamilyId(family.family_id);
    return {
      is_existing_member_family: true,
      is_sibling: siblings.length > 0,
    };
  }

  // --- Admin listing ---

  async list(filters: WaitingListEntryFilters = {}) {
    // Positions are worked out across the whole live list, then the filter is
    // applied, so a filtered view still shows a parent's real place in the
    // queue rather than their place among the rows on screen.
    const live = await this.repository.findEntriesByStatuses([
      WaitingListStatus.WAITING,
      WaitingListStatus.OFFERED,
    ]);
    const positioned = withPositions(live);
    const positionByEntry = new Map(positioned.map((row) => [row.entry_id, row.position]));

    const entries = await this.repository.findEntries(filters);
    const pendingOffers = await this.repository.findOffers([WaitingListOfferStatus.PENDING]);
    const offerByEntry = new Map(pendingOffers.map((offer) => [offer.entry_id, offer]));

    return entries.map((entry) => ({
      ...entry,
      position: positionByEntry.get(entry.entry_id) ?? null,
      pending_offer: offerByEntry.get(entry.entry_id) ?? null,
    }));
  }

  async findOne(entryId: string) {
    const entry = await this.repository.findEntry(entryId);
    if (!entry) {
      throw new NotFoundException(`Waiting list entry ${entryId} not found`);
    }
    const offers = await this.repository.findOffersForEntry(entryId);
    return {
      ...entry,
      position: await this.positionOf(entryId),
      offers,
    };
  }

  private async positionOf(entryId: string): Promise<number> {
    const live = await this.repository.findEntriesByStatuses([
      WaitingListStatus.WAITING,
      WaitingListStatus.OFFERED,
    ]);
    const found = withPositions(live).find((row) => row.entry_id === entryId);
    return found?.position ?? 0;
  }

  async summary(): Promise<WaitingListSummary> {
    const live = await this.repository.findEntriesByStatuses([
      WaitingListStatus.WAITING,
      WaitingListStatus.OFFERED,
    ]);
    const waiting = live.filter((entry) => entry.status === WaitingListStatus.WAITING).length;
    const offered = live.filter((entry) => entry.status === WaitingListStatus.OFFERED).length;
    const enrolled = await this.repository.countEntriesByStatus(WaitingListStatus.ENROLLED);

    const pendingOffers = await this.repository.findOffers([WaitingListOfferStatus.PENDING]);
    const cutoff = Date.now() + 48 * 60 * 60 * 1000;
    const expiringSoon = pendingOffers.filter(
      (offer) => new Date(offer.expires_at).getTime() <= cutoff,
    ).length;

    const oldest = live.reduce<number | null>((longest, entry) => {
      const days = Math.floor(
        (Date.now() - new Date(entry.joined_at).getTime()) / (24 * 60 * 60 * 1000),
      );
      return longest === null || days > longest ? days : longest;
    }, null);

    return {
      waiting,
      offered,
      enrolled,
      offers_expiring_within_48_hours: expiringSoon,
      longest_wait_days: oldest,
    };
  }

  // --- Admin writes ---

  async createEntry(dto: CreateWaitingListEntryDto): Promise<WaitingListEntry> {
    const email = dto.parent_email.trim().toLowerCase();
    const derived = await this.derivePriority(email);
    const entry = await this.repository.createEntry({
      child_first_name: dto.child_first_name.trim(),
      child_last_name: dto.child_last_name.trim(),
      child_dob: new Date(dto.child_dob),
      child_gender: dto.child_gender ?? null,
      parent_name: dto.parent_name.trim(),
      parent_email: email,
      parent_phone: dto.parent_phone ?? null,
      desired_discipline: dto.desired_discipline ?? null,
      desired_squad_type: dto.desired_squad_type ?? null,
      preferred_squad_id: dto.preferred_squad_id ?? null,
      notes: dto.notes ?? null,
      joined_at: new Date(),
      status: WaitingListStatus.WAITING,
      // What the admin says wins over what was worked out.
      is_existing_member_family: dto.is_existing_member_family ?? derived.is_existing_member_family,
      is_sibling: dto.is_sibling ?? derived.is_sibling,
      priority_boost: dto.priority_boost ?? 0,
    });
    await this.offersService.autoOfferAcrossClub();
    return entry;
  }

  async updateEntry(entryId: string, dto: UpdateWaitingListEntryDto): Promise<WaitingListEntry> {
    const existing = await this.repository.findEntry(entryId);
    if (!existing) {
      throw new NotFoundException(`Waiting list entry ${entryId} not found`);
    }

    const fields: Partial<WaitingListEntry> = { ...dto } as Partial<WaitingListEntry>;
    if (dto.child_dob) {
      fields.child_dob = new Date(dto.child_dob);
    }
    if (dto.parent_email) {
      fields.parent_email = dto.parent_email.trim().toLowerCase();
    }

    const updated = await this.repository.updateEntry(entryId, fields);
    // A boost or a change of what the family wants can make them eligible for
    // a place that is already free, so re-run the offer pass.
    await this.offersService.autoOfferAcrossClub();
    return updated!;
  }

  /**
   * Taking a child off the list. Any live offer goes with them, which frees
   * the place it was holding for the next family.
   */
  async withdrawEntry(entryId: string, reason?: string): Promise<WaitingListEntry> {
    const entry = await this.repository.findEntry(entryId);
    if (!entry) {
      throw new NotFoundException(`Waiting list entry ${entryId} not found`);
    }
    if (entry.status === WaitingListStatus.ENROLLED) {
      throw new BadRequestException(
        'This child is already enrolled. Remove them from the squad instead.',
      );
    }

    const pending = await this.repository.findPendingOfferForEntry(entryId);

    // Mark the withdrawal before releasing any offer, so the refill pass that
    // follows sees a withdrawn entry and gives the place to somebody else.
    const updated = await this.repository.updateEntry(entryId, {
      status: WaitingListStatus.WITHDRAWN,
      withdrawn_reason: reason ?? null,
    });

    if (pending) {
      await this.offersService.withdraw(pending.offer_id, false);
    }

    return updated!;
  }

  /**
   * Enrolling straight off the list, without waiting for an offer round trip.
   * Same one action, same result; this is the path an admin takes when the
   * family has already said yes on the phone.
   */
  async enrolEntry(entryId: string, squadId: string | null): Promise<EnrolmentResult> {
    const entry = await this.repository.findEntry(entryId);
    if (!entry) {
      throw new NotFoundException(`Waiting list entry ${entryId} not found`);
    }
    if (squadId) {
      const squad = await this.squadsRepository.findOne(squadId);
      if (!squad) {
        throw new NotFoundException(`Squad ${squadId} not found`);
      }
    }

    // Any live offer for this child is now spent, whichever squad it named.
    const pending = await this.repository.findPendingOfferForEntry(entryId);
    if (pending && pending.squad_id === squadId) {
      return await this.offersService.accept(pending);
    }
    if (pending) {
      // The entry is about to be enrolled, so it must not be handed back to
      // the waiting pool between here and the enrolment.
      await this.offersService.withdraw(pending.offer_id, false);
    }

    return await this.enrolmentService.enrol(entry, squadId);
  }

  // --- Settings ---

  async getSettings() {
    return await this.offersService.resolveSettings();
  }

  async updateSettings(dto: UpdateWaitingListSettingsDto) {
    await this.repository.upsertSettings(dto);
    const settings = await this.offersService.resolveSettings();
    // Switching auto-offer on should act on the backlog immediately rather
    // than waiting for the next capacity change.
    if (settings.auto_offer_enabled) {
      await this.offersService.autoOfferAcrossClub();
    }
    return settings;
  }
}
