import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import {
  DEFAULT_OFFER_WINDOW_DAYS,
  WaitingListOfferStatus,
  WaitingListStatus,
} from '@club-manager/shared-types';
import { SquadCapacityEvents } from '../../common/capacity/squad-capacity.events';
import { formatClubDate } from '../../common/region/format.util';
import { CLS_CLUB_ID_KEY } from '../../common/tenancy/tenant-context.service';
import { ClubsRepository } from '../clubs/clubs.repository';
import { ClubsService } from '../clubs/clubs.service';
import { EmailService } from '../email/email.service';
import { Squad } from '../squads/entities/squad.entity';
import { SquadsRepository } from '../squads/squads.repository';
import { EnrolmentResult, EnrolmentService } from './enrolment.service';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListOffer } from './entities/waiting-list-offer.entity';
import { comparePriority, freePlaces, isEligible } from './waiting-list.rules';
import { WaitingListRepository } from './waiting-list.repository';

/** Effective per-club settings, with the defaults already applied. */
export interface ResolvedWaitingListSettings {
  auto_offer_enabled: boolean;
  offer_window_days: number;
}

/**
 * The auto-offer engine (TEM-22, docs/05 rule 3).
 *
 * When a place opens in a squad the highest-priority eligible child on the
 * list is offered it, without anyone asking. The offer is time-boxed; when the
 * window closes the place falls through to the next child immediately. Manual
 * invite still exists, but it is the fallback, not the default.
 *
 * A pending offer reserves its place, so the same place is never offered to
 * two families at once, and the reservation disappears the moment the offer is
 * declined, withdrawn or lapses.
 */
@Injectable()
export class WaitingListOffersService implements OnModuleInit {
  private readonly logger = new Logger(WaitingListOffersService.name);
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly waitingList: WaitingListRepository,
    private readonly squadsRepository: SquadsRepository,
    private readonly emailService: EmailService,
    private readonly clubsRepository: ClubsRepository,
    private readonly clubsService: ClubsService,
    private readonly enrolmentService: EnrolmentService,
    private readonly capacityEvents: SquadCapacityEvents,
    private readonly cls: ClsService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  /**
   * Subscribe to the capacity signal the squads and members modules publish.
   * Everything they have to know is "a place may have opened in this squad";
   * whether one really did, and who gets it, is decided here.
   */
  onModuleInit(): void {
    this.capacityEvents.onPlaceMayHaveOpened(async (squadId) => {
      await this.autoOfferForSquad(squadId);
    });
  }

  // --- Settings ---

  async resolveSettings(): Promise<ResolvedWaitingListSettings> {
    const stored = await this.waitingList.findSettings();
    return {
      auto_offer_enabled: stored?.auto_offer_enabled ?? true,
      offer_window_days: stored?.offer_window_days ?? DEFAULT_OFFER_WINDOW_DAYS,
    };
  }

  // --- The engine ---

  /**
   * Offers every free place in one squad to the entries at the top of the
   * list. Does nothing when auto-offer is switched off for the club, when the
   * squad records no capacity (nothing can be said to have opened), or when
   * nobody eligible is waiting.
   */
  async autoOfferForSquad(squadId: string): Promise<WaitingListOffer[]> {
    const settings = await this.resolveSettings();
    if (!settings.auto_offer_enabled) {
      return [];
    }
    return await this.offerFreePlaces(squadId, settings.offer_window_days);
  }

  /**
   * Sweeps every squad in the active club. Used by the cron as a safety net
   * behind the capacity signal, and after a new entry joins in case a place
   * was already going spare.
   */
  async autoOfferAcrossClub(): Promise<number> {
    const settings = await this.resolveSettings();
    if (!settings.auto_offer_enabled) {
      return 0;
    }
    const squads = await this.squadsRepository.findAll();
    let offered = 0;
    for (const squad of squads) {
      const offers = await this.offerFreePlaces(squad.squad_id, settings.offer_window_days, squad);
      offered += offers.length;
    }
    return offered;
  }

  private async offerFreePlaces(
    squadId: string,
    offerWindowDays: number,
    preloadedSquad?: Squad,
  ): Promise<WaitingListOffer[]> {
    const squad = preloadedSquad ?? (await this.squadsRepository.findOne(squadId));
    if (!squad) {
      return [];
    }

    const pending = await this.waitingList.findPendingOffersForSquad(squad.squad_id);
    // squad.members is the squad_members join table, which is what the squads
    // module itself treats as the roster: assignMember's own capacity guard
    // counts it, and removeMember is what frees a place. The members.squad_id
    // column is a second, looser record of the same thing that the member form
    // and the importers write without touching the join table; counting it too
    // would mean a member removed from the squad never released their place,
    // because their stale squad_id would still be there. So the join table is
    // the one source used here, and auto-offer agrees with the squad screen.
    const places = freePlaces(squad.max_capacity, squad.members?.length ?? 0, pending.length);
    if (places === null || places <= 0) {
      return [];
    }

    const now = new Date();
    // A family that has already said no to this class, or let an offer of it
    // lapse, is not asked again automatically. Without this the place would
    // bounce straight back to the person who just turned it down.
    const passedOver = await this.waitingList.findEntryIdsPassedOverForSquad(squad.squad_id);
    const waiting = await this.waitingList.findEntriesByStatuses([WaitingListStatus.WAITING]);
    const eligible = waiting
      .filter((entry) => !passedOver.has(entry.entry_id) && isEligible(entry, squad, now))
      .sort(comparePriority)
      .slice(0, places);

    const created: WaitingListOffer[] = [];
    for (const entry of eligible) {
      created.push(await this.makeOffer(entry, squad, offerWindowDays));
    }

    if (created.length > 0) {
      this.logger.log(
        `Auto-offered ${created.length} place(s) in squad ${squad.squad_name} (${squad.squad_id})`,
      );
    }
    return created;
  }

  /**
   * A manual offer, made by an admin who has picked both the entry and the
   * squad. The eligibility rules still apply: the point of the list is that
   * nobody is put in a class they are too young for or did not ask for.
   */
  async offerManually(
    entryId: string,
    squadId: string,
    expiresInDays?: number,
  ): Promise<WaitingListOffer> {
    const entry = await this.waitingList.findEntry(entryId);
    if (!entry) {
      throw new NotFoundException(`Waiting list entry ${entryId} not found`);
    }
    const squad = await this.squadsRepository.findOne(squadId);
    if (!squad) {
      throw new NotFoundException(`Squad ${squadId} not found`);
    }
    if (entry.status !== WaitingListStatus.WAITING) {
      throw new BadRequestException(
        `This entry is ${entry.status}, so it cannot be offered a place`,
      );
    }
    if (!isEligible(entry, squad, new Date())) {
      throw new BadRequestException(
        `${entry.child_first_name} is not eligible for ${squad.squad_name}. ` +
          'Change what the family asked for, or the class age range, first.',
      );
    }

    const settings = await this.resolveSettings();
    return await this.makeOffer(entry, squad, expiresInDays ?? settings.offer_window_days);
  }

  private async makeOffer(
    entry: WaitingListEntry,
    squad: Squad,
    offerWindowDays: number,
  ): Promise<WaitingListOffer> {
    const expiresAt = new Date(Date.now() + offerWindowDays * 24 * 60 * 60 * 1000);
    const offer = await this.waitingList.createOffer({
      entry_id: entry.entry_id,
      squad_id: squad.squad_id,
      offered_at: new Date(),
      expires_at: expiresAt,
      status: WaitingListOfferStatus.PENDING,
      accept_token: randomBytes(32).toString('hex'),
    });

    await this.waitingList.updateEntry(entry.entry_id, { status: WaitingListStatus.OFFERED });

    await this.sendOfferEmail(entry, squad, offer);
    return offer;
  }

  private async sendOfferEmail(
    entry: WaitingListEntry,
    squad: Squad,
    offer: WaitingListOffer,
  ): Promise<void> {
    const club = await this.clubsRepository.findOne(entry.club_id).catch(() => null);
    try {
      await this.emailService.sendWaitingListOffer({
        recipientEmail: entry.parent_email,
        parentName: entry.parent_name,
        childName: `${entry.child_first_name} ${entry.child_last_name}`,
        clubName: club?.name ?? 'your club',
        squadName: squad.squad_name,
        trainingTimes: squad.training_times,
        coachName: squad.coach_name,
        expiresOn: formatClubDate(
          offer.expires_at,
          club?.locale ?? 'en-GB',
          club?.timezone ?? 'Europe/London',
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
        ),
        acceptUrl: `${this.appUrl}/offer/${offer.accept_token}`,
        declineUrl: `${this.appUrl}/offer/${offer.accept_token}?decline=1`,
      });
    } catch (error) {
      // A failed send must not lose the offer: the place is already reserved
      // and the admin screen shows it, so the club can chase by hand.
      this.logger.error(
        `Could not email the offer for entry ${entry.entry_id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // --- Responses ---

  /** Accepting is the one click: it enrols the child behind the offer. */
  async accept(offer: WaitingListOffer): Promise<EnrolmentResult> {
    this.assertAnswerable(offer);
    const entry = offer.entry ?? (await this.waitingList.findEntry(offer.entry_id));
    if (!entry) {
      throw new NotFoundException('The waiting list entry behind this offer no longer exists');
    }

    // Enrol first, then spend the offer. Marking it accepted up front would
    // burn the single-use link before the enrolment could refuse the entry
    // (a missing gender, say), leaving the family with a dead link and the
    // entry stranded in `offered`: no pending offer to answer, and no way
    // back into the auto-offer pool, which only looks at waiting entries.
    const result = await this.enrolmentService.enrol(entry, offer.squad_id);

    await this.waitingList.updateOffer(offer.offer_id, {
      status: WaitingListOfferStatus.ACCEPTED,
      responded_at: new Date(),
      // The token has been spent. Clearing it stops the link working twice.
      accept_token: null,
    });

    return result;
  }

  /**
   * Declining frees the reserved place at once and the next eligible child is
   * offered it in the same breath. The entry goes back to waiting: this family
   * said no to one class, not to the club.
   */
  async decline(offer: WaitingListOffer, reason?: string): Promise<void> {
    this.assertAnswerable(offer);
    await this.waitingList.updateOffer(offer.offer_id, {
      status: WaitingListOfferStatus.DECLINED,
      decline_reason: reason ?? null,
      responded_at: new Date(),
      accept_token: null,
    });
    await this.waitingList.updateEntry(offer.entry_id, { status: WaitingListStatus.WAITING });
    await this.autoOfferForSquad(offer.squad_id);
  }

  /**
   * The club pulling an offer back, which frees the place the same way.
   *
   * `returnEntryToWaiting` is true for an ordinary withdrawal, where the child
   * stays on the list. It is false when the caller has already decided the
   * entry's fate, as when a family withdraws from the list altogether: putting
   * them back to waiting there would let the refill pass immediately offer
   * them the place they have just left.
   */
  async withdraw(offerId: string, returnEntryToWaiting = true): Promise<void> {
    const offer = await this.waitingList.findOffer(offerId);
    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }
    this.assertAnswerable(offer);
    await this.waitingList.updateOffer(offerId, {
      status: WaitingListOfferStatus.WITHDRAWN,
      responded_at: new Date(),
      accept_token: null,
    });
    if (returnEntryToWaiting) {
      await this.waitingList.updateEntry(offer.entry_id, { status: WaitingListStatus.WAITING });
    }
    await this.autoOfferForSquad(offer.squad_id);
  }

  private assertAnswerable(offer: WaitingListOffer): void {
    if (offer.status !== WaitingListOfferStatus.PENDING) {
      throw new BadRequestException(`This offer has already been ${offer.status}`);
    }
  }

  /**
   * Closes every offer whose window has passed and immediately offers the
   * place on. Club-scoped: the caller establishes the tenant.
   */
  async expireLapsedOffers(now: Date = new Date()): Promise<number> {
    const lapsed = await this.waitingList.findLapsedPendingOffers(now);
    const squadsToRefill = new Set<string>();

    for (const offer of lapsed) {
      await this.waitingList.updateOffer(offer.offer_id, {
        status: WaitingListOfferStatus.EXPIRED,
        responded_at: now,
        accept_token: null,
      });
      // The child keeps their place on the list and their position with it.
      // Only an entry still holding the offer goes back to waiting: if it has
      // moved on since (enrolled through the admin screen, or withdrawn from
      // the list), that later state is the true one and must not be undone.
      if ((offer.entry?.status ?? WaitingListStatus.OFFERED) === WaitingListStatus.OFFERED) {
        await this.waitingList.updateEntry(offer.entry_id, { status: WaitingListStatus.WAITING });
      }
      squadsToRefill.add(offer.squad_id);
      this.logger.log(
        `Offer ${offer.offer_id} lapsed; the place in squad ${offer.squad_id} falls through`,
      );
    }

    for (const squadId of squadsToRefill) {
      await this.autoOfferForSquad(squadId);
    }

    return lapsed.length;
  }

  /**
   * Hourly across every club: close the offers that have run out of time and
   * pass the places on, then sweep for capacity that opened without the
   * in-process signal reaching us (a restart, a direct database change, a
   * squad whose capacity was raised while the app was down).
   *
   * Like the consent expiry cron, this is a background job with no request
   * context, so each club runs inside its own CLS scope and stays isolated.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepOffers(): Promise<void> {
    this.logger.log('Running the waiting list offer sweep across all clubs...');
    const clubs = await this.clubsService.findAll();
    for (const club of clubs) {
      await this.cls.run(async () => {
        this.cls.set(CLS_CLUB_ID_KEY, club.id);
        try {
          const expired = await this.expireLapsedOffers();
          const offered = await this.autoOfferAcrossClub();
          if (expired > 0 || offered > 0) {
            this.logger.log(
              `${club.name}: ${expired} offer(s) lapsed, ${offered} new offer(s) made`,
            );
          }
        } catch (error) {
          this.logger.error(
            `The waiting list sweep failed for club ${club.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      });
    }
  }
}
