import type { Discipline, SquadType } from '@club-manager/shared-types';

import { api } from './api-client';

/**
 * The club's waiting list (TEM-22).
 *
 * Note this is not lib/api/waitlist.ts, which talks to the product's own
 * launch waiting list. The two are unrelated and are deliberately kept apart.
 */

export type WaitingListStatus = 'waiting' | 'offered' | 'enrolled' | 'withdrawn' | 'expired';
export type WaitingListOfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn';

export interface WaitingListOffer {
  offer_id: string;
  entry_id: string;
  squad_id: string;
  offered_at: string;
  expires_at: string;
  status: WaitingListOfferStatus;
  decline_reason: string | null;
  responded_at: string | null;
  squad?: { squad_id: string; squad_name: string; training_times: string | null } | null;
  entry?: WaitingListEntry | null;
}

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
  desired_discipline: Discipline | null;
  desired_squad_type: SquadType | null;
  preferred_squad_id: string | null;
  notes: string | null;
  joined_at: string;
  is_existing_member_family: boolean;
  is_sibling: boolean;
  priority_boost: number;
  status: WaitingListStatus;
  enrolled_member_id: string | null;
  withdrawn_reason: string | null;
  preferred_squad?: { squad_id: string; squad_name: string } | null;
}

/** A list row: the entry plus its place in the queue and any live offer. */
export interface WaitingListRow extends WaitingListEntry {
  /** Null once the child is out of the running (enrolled, withdrawn, lapsed). */
  position: number | null;
  pending_offer: WaitingListOffer | null;
}

export interface WaitingListEntryDetail extends WaitingListEntry {
  position: number;
  offers: WaitingListOffer[];
}

export interface WaitingListSummary {
  waiting: number;
  offered: number;
  enrolled: number;
  offers_expiring_within_48_hours: number;
  longest_wait_days: number | null;
}

export interface WaitingListSettings {
  auto_offer_enabled: boolean;
  offer_window_days: number;
}

/** What one enrolment did, and anything left for a person to deal with. */
export interface EnrolmentResult {
  entry_id: string;
  member_id: string;
  family_id: string;
  family_created: boolean;
  squad_id: string | null;
  squad_assigned: boolean;
  consents_requested: number;
  invite_url: string | null;
  enrolment_email_sent: boolean;
  mandate_email_sent: boolean;
  mandate_already_active: boolean;
  needs_attention: string[];
}

export interface CreateWaitingListEntryInput {
  child_first_name: string;
  child_last_name: string;
  child_dob: string;
  child_gender?: string;
  parent_name: string;
  parent_email: string;
  parent_phone?: string;
  desired_discipline?: Discipline;
  desired_squad_type?: SquadType;
  preferred_squad_id?: string;
  notes?: string;
  is_existing_member_family?: boolean;
  is_sibling?: boolean;
  priority_boost?: number;
}

export type UpdateWaitingListEntryInput = Partial<CreateWaitingListEntryInput>;

export interface WaitingListFilters {
  status?: WaitingListStatus;
  discipline?: Discipline;
  squad_type?: SquadType;
}

// ==================== Admin ====================

export async function getWaitingList(filters: WaitingListFilters = {}): Promise<WaitingListRow[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.discipline) params.set('discipline', filters.discipline);
  if (filters.squad_type) params.set('squad_type', filters.squad_type);
  const query = params.toString();
  return api.get<WaitingListRow[]>(`/waiting-list${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  });
}

export async function getWaitingListSummary(): Promise<WaitingListSummary> {
  return api.get<WaitingListSummary>('/waiting-list/summary', { cache: 'no-store' });
}

export async function getWaitingListEntry(entryId: string): Promise<WaitingListEntryDetail> {
  return api.get<WaitingListEntryDetail>(`/waiting-list/entries/${entryId}`, {
    cache: 'no-store',
  });
}

export async function getPendingOffers(): Promise<WaitingListOffer[]> {
  return api.get<WaitingListOffer[]>('/waiting-list/offers', { cache: 'no-store' });
}

export async function createWaitingListEntry(
  data: CreateWaitingListEntryInput
): Promise<WaitingListEntry> {
  return api.post<WaitingListEntry>('/waiting-list/entries', data);
}

export async function updateWaitingListEntry(
  entryId: string,
  data: UpdateWaitingListEntryInput
): Promise<WaitingListEntry> {
  return api.patch<WaitingListEntry>(`/waiting-list/entries/${entryId}`, data);
}

export async function withdrawWaitingListEntry(
  entryId: string,
  reason?: string
): Promise<WaitingListEntry> {
  return api.post<WaitingListEntry>(`/waiting-list/entries/${entryId}/withdraw`, { reason });
}

/** The manual fallback: offer a named entry a place in a named squad. */
export async function offerPlace(
  entryId: string,
  squadId: string,
  expiresInDays?: number
): Promise<WaitingListOffer> {
  return api.post<WaitingListOffer>(`/waiting-list/entries/${entryId}/offer`, {
    squad_id: squadId,
    ...(expiresInDays ? { expires_in_days: expiresInDays } : {}),
  });
}

export async function withdrawOffer(offerId: string): Promise<{ withdrawn: boolean }> {
  return api.post<{ withdrawn: boolean }>(`/waiting-list/offers/${offerId}/withdraw`);
}

/** One click: waiting list to enrolled, billed member. */
export async function enrolFromWaitingList(
  entryId: string,
  squadId: string | null
): Promise<EnrolmentResult> {
  return api.post<EnrolmentResult>(`/waiting-list/entries/${entryId}/enrol`, {
    ...(squadId ? { squad_id: squadId } : {}),
  });
}

export async function getWaitingListSettings(): Promise<WaitingListSettings> {
  return api.get<WaitingListSettings>('/waiting-list/settings', { cache: 'no-store' });
}

export async function updateWaitingListSettings(
  data: Partial<WaitingListSettings>
): Promise<WaitingListSettings> {
  return api.put<WaitingListSettings>('/waiting-list/settings', data);
}

// ==================== Public ====================

export interface PublicClubDetails {
  club_name: string;
  club_slug: string;
  squads: Array<{
    squad_id: string;
    squad_name: string;
    squad_type: SquadType | null;
    discipline: Discipline | null;
  }>;
}

export interface JoinWaitingListInput {
  child_first_name: string;
  child_last_name: string;
  child_dob: string;
  child_gender?: string;
  parent_name: string;
  parent_email: string;
  parent_phone?: string;
  desired_discipline?: Discipline;
  desired_squad_type?: SquadType;
  preferred_squad_id?: string;
  notes?: string;
}

export interface JoinWaitingListResult {
  entry_id: string;
  club_name: string;
  position: number;
  already_on_list: boolean;
}

export async function getPublicClubDetails(clubSlug: string): Promise<PublicClubDetails> {
  return api.get<PublicClubDetails>(`/waiting-list/public/${clubSlug}`, { cache: 'no-store' });
}

export async function joinWaitingList(
  clubSlug: string,
  data: JoinWaitingListInput
): Promise<JoinWaitingListResult> {
  return api.post<JoinWaitingListResult>(`/waiting-list/join/${clubSlug}`, data);
}

export interface PublicOfferView {
  offer_id: string;
  status: WaitingListOfferStatus;
  expires_at: string;
  club_name: string | null;
  squad_name: string | null;
  training_times: string | null;
  child_name: string | null;
  expired: boolean;
}

export interface AcceptOfferResult {
  enrolled: boolean;
  squad_assigned: boolean;
  invite_url: string | null;
  mandate_setup_required: boolean;
}

export async function getPublicOffer(token: string): Promise<PublicOfferView> {
  return api.get<PublicOfferView>(`/waiting-list/offers/token/${token}`, { cache: 'no-store' });
}

export async function acceptPublicOffer(token: string): Promise<AcceptOfferResult> {
  return api.post<AcceptOfferResult>(`/waiting-list/offers/token/${token}/accept`);
}

export async function declinePublicOffer(
  token: string,
  reason?: string
): Promise<{ declined: boolean }> {
  return api.post<{ declined: boolean }>(`/waiting-list/offers/token/${token}/decline`, {
    ...(reason ? { reason } : {}),
  });
}
