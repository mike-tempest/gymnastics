import { Discipline, SquadType } from '../enums/disciplines';

/**
 * The waiting list to enrolled member flow (TEM-22).
 *
 * This is the club's own waiting list for places in its classes and squads,
 * which is a different thing entirely from the launch waiting list clubs join
 * to hear about the product. Nothing here relates to that one.
 *
 * A place opening in a squad produces an offer to the highest-priority
 * eligible entry, the offer is time-boxed, and accepting it enrols the child
 * in one action. The statuses below are the whole life cycle.
 */

/** Where a child has got to on the club's waiting list. */
export enum WaitingListStatus {
  /** On the list, waiting for a place. */
  WAITING = 'waiting',
  /** Holding a live offer of a place, which is reserved until it expires. */
  OFFERED = 'offered',
  /** Took the place and is now a member. */
  ENROLLED = 'enrolled',
  /** Taken off the list, by the family or by the club. */
  WITHDRAWN = 'withdrawn',
  /** Every offer made lapsed and the family did not come back. */
  EXPIRED = 'expired',
}

/** What became of one offer of a place. */
export enum WaitingListOfferStatus {
  /** Live: the place is reserved and the acceptance window is open. */
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  /** The window closed with no answer. The place falls through automatically. */
  EXPIRED = 'expired',
  /** Pulled by the club before the family answered. */
  WITHDRAWN = 'withdrawn',
}

/** Default acceptance window, in days, when a club has not chosen its own. */
export const DEFAULT_OFFER_WINDOW_DAYS = 7;

/** Bounds on the per-club acceptance window. */
export const MIN_OFFER_WINDOW_DAYS = 1;
export const MAX_OFFER_WINDOW_DAYS = 60;

/**
 * One child waiting for a place. The parent's details live here rather than on
 * a family record because joining the list requires no account: the family is
 * only created at enrolment.
 */
export interface WaitingListEntry {
  entry_id: string;
  club_id: string;
  child_first_name: string;
  child_last_name: string;
  child_dob: string;
  child_gender: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string | null;
  /** What the family asked for. Any of these may be left open. */
  desired_discipline: Discipline | null;
  desired_squad_type: SquadType | null;
  preferred_squad_id: string | null;
  notes: string | null;
  joined_at: string;
  /** Priority flags, applied in the order given by WAITING_LIST_PRIORITY_ORDER. */
  is_existing_member_family: boolean;
  is_sibling: boolean;
  priority_boost: number;
  status: WaitingListStatus;
  /** Set once the entry becomes a member. */
  enrolled_member_id: string | null;
  withdrawn_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** One offer of a specific squad place to one entry. */
export interface WaitingListOffer {
  offer_id: string;
  club_id: string;
  entry_id: string;
  squad_id: string;
  offered_at: string;
  expires_at: string;
  status: WaitingListOfferStatus;
  decline_reason: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Per-club waiting list behaviour. */
export interface WaitingListSettings {
  club_id: string;
  /** Auto-offer is on by default: manual invite is the fallback, not the norm. */
  auto_offer_enabled: boolean;
  offer_window_days: number;
}

/**
 * The order places are offered in, most significant first. An admin boost
 * beats everything, then existing member families, then siblings of current
 * members, and only then how long the child has been waiting.
 */
export const WAITING_LIST_PRIORITY_ORDER = [
  'priority_boost',
  'is_existing_member_family',
  'is_sibling',
  'joined_at',
] as const;

export const WAITING_LIST_STATUS_LABELS: Record<WaitingListStatus, string> = {
  [WaitingListStatus.WAITING]: 'Waiting',
  [WaitingListStatus.OFFERED]: 'Offered',
  [WaitingListStatus.ENROLLED]: 'Enrolled',
  [WaitingListStatus.WITHDRAWN]: 'Withdrawn',
  [WaitingListStatus.EXPIRED]: 'Lapsed',
};

export const WAITING_LIST_OFFER_STATUS_LABELS: Record<WaitingListOfferStatus, string> = {
  [WaitingListOfferStatus.PENDING]: 'Awaiting reply',
  [WaitingListOfferStatus.ACCEPTED]: 'Accepted',
  [WaitingListOfferStatus.DECLINED]: 'Declined',
  [WaitingListOfferStatus.EXPIRED]: 'Lapsed',
  [WaitingListOfferStatus.WITHDRAWN]: 'Withdrawn',
};
