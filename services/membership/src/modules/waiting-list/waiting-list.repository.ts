import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import {
  Discipline,
  SquadType,
  WaitingListOfferStatus,
  WaitingListStatus,
} from '@club-manager/shared-types';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListOffer } from './entities/waiting-list-offer.entity';
import { WaitingListSettings } from './entities/waiting-list-settings.entity';

/** Optional narrowing applied to the admin listing. Filters only narrow. */
export interface WaitingListEntryFilters {
  status?: WaitingListStatus;
  discipline?: Discipline;
  squadType?: SquadType;
}

/**
 * Every read here goes through TenantScopedHelper and every write is either
 * stamped with the active club or predicated on it, so an id belonging to
 * another club behaves as not-found rather than leaking or mutating a row.
 *
 * Two methods are deliberate exceptions and say so on the tin:
 * findOfferByTokenAcrossClubs and findEntryByIdAcrossClubs serve the public
 * offer links, which arrive with no tenant context at all. They are safe
 * because the token is a 64-character random secret that identifies exactly
 * one offer; the caller establishes the tenant from the row it finds.
 */
@Injectable()
export class WaitingListRepository {
  constructor(
    @InjectRepository(WaitingListEntry)
    private readonly entryRepo: Repository<WaitingListEntry>,
    @InjectRepository(WaitingListOffer)
    private readonly offerRepo: Repository<WaitingListOffer>,
    @InjectRepository(WaitingListSettings)
    private readonly settingsRepo: Repository<WaitingListSettings>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  // --- Entries ---

  /**
   * Entries for the active club in priority order: admin boost, then existing
   * member families, then siblings, then how long they have waited. That is
   * the order places are offered in, so it is also the order the list reads
   * in and the order positions are numbered in.
   */
  async findEntries(filters: WaitingListEntryFilters = {}): Promise<WaitingListEntry[]> {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.discipline) where.desired_discipline = filters.discipline;
    if (filters.squadType) where.desired_squad_type = filters.squadType;

    return await this.scoped.scopedFind(this.entryRepo, {
      where,
      relations: ['preferred_squad'],
      order: {
        priority_boost: 'DESC',
        is_existing_member_family: 'DESC',
        is_sibling: 'DESC',
        joined_at: 'ASC',
      },
    });
  }

  /** Entries in one of the given statuses, in the same priority order. */
  async findEntriesByStatuses(statuses: WaitingListStatus[]): Promise<WaitingListEntry[]> {
    if (statuses.length === 0) return [];
    return await this.scoped.scopedFind(this.entryRepo, {
      where: { status: In(statuses) },
      relations: ['preferred_squad'],
      order: {
        priority_boost: 'DESC',
        is_existing_member_family: 'DESC',
        is_sibling: 'DESC',
        joined_at: 'ASC',
      },
    });
  }

  async findEntry(entryId: string): Promise<WaitingListEntry | null> {
    return await this.scoped.scopedFindOne(this.entryRepo, {
      where: { entry_id: entryId },
      relations: ['preferred_squad'],
    });
  }

  /** Duplicate check for the public join endpoint: same child, same club. */
  async findLiveEntryForChild(
    firstName: string,
    lastName: string,
    dob: string,
    email: string,
  ): Promise<WaitingListEntry | null> {
    const candidates = await this.scoped.scopedFind(this.entryRepo, {
      where: {
        parent_email: email,
        status: In([WaitingListStatus.WAITING, WaitingListStatus.OFFERED]),
      },
    });
    const target = `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${dob}`;
    return (
      candidates.find(
        (entry) =>
          `${entry.child_first_name.trim().toLowerCase()}|` +
            `${entry.child_last_name.trim().toLowerCase()}|` +
            `${toDateKey(entry.child_dob)}` ===
          target,
      ) ?? null
    );
  }

  async createEntry(fields: Partial<WaitingListEntry>): Promise<WaitingListEntry> {
    // Stamp club_id from the active tenant; never trust one supplied by a caller.
    const { club_id: _ignored, ...rest } = fields;
    const entry = this.entryRepo.create(this.scoped.stampCreate<WaitingListEntry>(rest));
    return await this.entryRepo.save(entry);
  }

  async updateEntry(
    entryId: string,
    fields: Partial<WaitingListEntry>,
  ): Promise<WaitingListEntry | null> {
    const { club_id: _ignored, ...rest } = fields;
    // Every field is optional, so an empty body is a legitimate request.
    // TypeORM throws on an update with no values, so treat it as the no-op it is.
    if (Object.keys(rest).length > 0) {
      await this.entryRepo.update(
        { entry_id: entryId, club_id: this.tenantContext.getClubId() },
        rest,
      );
    }
    return this.findEntry(entryId);
  }

  async countEntriesByStatus(status: WaitingListStatus): Promise<number> {
    return await this.entryRepo.count({
      where: { status, club_id: this.tenantContext.getClubId() },
    });
  }

  // --- Offers ---

  async findOffers(statuses?: WaitingListOfferStatus[]): Promise<WaitingListOffer[]> {
    return await this.scoped.scopedFind(this.offerRepo, {
      where: statuses && statuses.length > 0 ? { status: In(statuses) } : {},
      relations: ['entry', 'squad'],
      order: { expires_at: 'ASC' },
    });
  }

  async findOffer(offerId: string): Promise<WaitingListOffer | null> {
    return await this.scoped.scopedFindOne(this.offerRepo, {
      where: { offer_id: offerId },
      relations: ['entry', 'squad'],
    });
  }

  async findOffersForEntry(entryId: string): Promise<WaitingListOffer[]> {
    return await this.scoped.scopedFind(this.offerRepo, {
      where: { entry_id: entryId },
      relations: ['squad'],
      order: { offered_at: 'DESC' },
    });
  }

  /** Live offers against one squad. These reserve places. */
  async findPendingOffersForSquad(squadId: string): Promise<WaitingListOffer[]> {
    return await this.scoped.scopedFind(this.offerRepo, {
      where: { squad_id: squadId, status: WaitingListOfferStatus.PENDING },
    });
  }

  async findPendingOfferForEntry(entryId: string): Promise<WaitingListOffer | null> {
    return await this.scoped.scopedFindOne(this.offerRepo, {
      where: { entry_id: entryId, status: WaitingListOfferStatus.PENDING },
      relations: ['squad'],
    });
  }

  /**
   * Entries that have already turned down, or failed to answer, an offer of a
   * place in this squad. Auto-offer skips them for this squad so a family is
   * not asked the same question twice by a machine; a club can still offer
   * manually, and the entry keeps its place in the queue for every other
   * squad.
   */
  async findEntryIdsPassedOverForSquad(squadId: string): Promise<Set<string>> {
    const offers = await this.scoped.scopedFind(this.offerRepo, {
      where: {
        squad_id: squadId,
        status: In([WaitingListOfferStatus.DECLINED, WaitingListOfferStatus.EXPIRED]),
      },
      select: ['offer_id', 'entry_id'],
    });
    return new Set(offers.map((offer) => offer.entry_id));
  }

  async createOffer(fields: Partial<WaitingListOffer>): Promise<WaitingListOffer> {
    const { club_id: _ignored, ...rest } = fields;
    const offer = this.offerRepo.create(this.scoped.stampCreate<WaitingListOffer>(rest));
    return await this.offerRepo.save(offer);
  }

  async updateOffer(
    offerId: string,
    fields: Partial<WaitingListOffer>,
  ): Promise<WaitingListOffer | null> {
    const { club_id: _ignored, ...rest } = fields;
    if (Object.keys(rest).length > 0) {
      await this.offerRepo.update(
        { offer_id: offerId, club_id: this.tenantContext.getClubId() },
        rest,
      );
    }
    return this.findOffer(offerId);
  }

  /**
   * Pending offers whose window has closed, for the expiry sweep. Runs inside
   * a per-club CLS scope set by the cron, so it is club-scoped like the rest.
   */
  async findLapsedPendingOffers(now: Date): Promise<WaitingListOffer[]> {
    return await this.scoped.scopedFind(this.offerRepo, {
      where: {
        status: WaitingListOfferStatus.PENDING,
        expires_at: LessThanOrEqual(now),
      },
      relations: ['entry', 'squad'],
    });
  }

  /**
   * Resolves the offer behind a public accept or decline link.
   *
   * Deliberately unscoped: the caller has no tenant context yet, because the
   * parent has no account. The 64-character random token is the credential,
   * and the club is read off the row that comes back.
   */
  async findOfferByTokenAcrossClubs(token: string): Promise<WaitingListOffer | null> {
    if (!token) return null;
    return await this.offerRepo.findOne({
      where: { accept_token: token },
      relations: ['entry', 'squad'],
    });
  }

  // --- Settings ---

  async findSettings(): Promise<WaitingListSettings | null> {
    return await this.settingsRepo.findOne({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  async upsertSettings(fields: Partial<WaitingListSettings>): Promise<WaitingListSettings> {
    const clubId = this.tenantContext.getClubId();
    const { club_id: _ignored, ...rest } = fields;
    const existing = await this.settingsRepo.findOne({ where: { club_id: clubId } });
    if (existing) {
      if (Object.keys(rest).length > 0) {
        await this.settingsRepo.update({ club_id: clubId }, rest);
      }
      return (await this.settingsRepo.findOne({ where: { club_id: clubId } }))!;
    }
    const row = this.settingsRepo.create({ ...rest, club_id: clubId });
    return await this.settingsRepo.save(row);
  }
}

/** Normalises a date column (or ISO string) to YYYY-MM-DD for comparison. */
function toDateKey(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
