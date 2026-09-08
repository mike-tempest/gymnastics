import { WaitingListStatus } from '@club-manager/shared-types';
import { Squad } from '../squads/entities/squad.entity';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';

/**
 * The rules that decide who gets the next place. Kept as plain functions with
 * no database and no framework so the behaviour that matters most can be
 * tested directly.
 */

/** Age in whole years on a given date, the way a club counts it. */
export function ageInYearsAt(dob: Date | string, at: Date): number {
  const birth = typeof dob === 'string' ? new Date(dob) : new Date(dob);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** Why an entry cannot take a particular place, or null when it can. */
export function eligibilityProblem(
  entry: WaitingListEntry,
  squad: Squad,
  at: Date = new Date(),
): string | null {
  if (entry.status !== WaitingListStatus.WAITING) {
    return `The entry is ${entry.status}, not waiting`;
  }

  // A named preference is a hard constraint: a family that asked for one
  // specific class is not offered a different one behind their back.
  if (entry.preferred_squad_id && entry.preferred_squad_id !== squad.squad_id) {
    return 'The family asked for a different class';
  }

  if (entry.desired_discipline && squad.discipline !== entry.desired_discipline) {
    return 'The class is in a different discipline';
  }

  if (entry.desired_squad_type && squad.squad_type !== entry.desired_squad_type) {
    return 'The class is of a different type';
  }

  const age = ageInYearsAt(entry.child_dob, at);
  if (squad.min_age !== null && squad.min_age !== undefined && age < squad.min_age) {
    return `Too young for this class (${age}, minimum ${squad.min_age})`;
  }
  if (squad.max_age !== null && squad.max_age !== undefined && age > squad.max_age) {
    return `Too old for this class (${age}, maximum ${squad.max_age})`;
  }

  return null;
}

export function isEligible(entry: WaitingListEntry, squad: Squad, at: Date = new Date()): boolean {
  return eligibilityProblem(entry, squad, at) === null;
}

/**
 * Priority order, most significant first: an admin boost, then families who
 * already have a child at the club, then siblings of current members, then
 * how long the child has waited. Returns the usual negative/zero/positive
 * comparator result, so the first entry of a sorted list is offered first.
 */
export function comparePriority(a: WaitingListEntry, b: WaitingListEntry): number {
  if (a.priority_boost !== b.priority_boost) {
    return b.priority_boost - a.priority_boost;
  }
  if (a.is_existing_member_family !== b.is_existing_member_family) {
    return a.is_existing_member_family ? -1 : 1;
  }
  if (a.is_sibling !== b.is_sibling) {
    return a.is_sibling ? -1 : 1;
  }
  return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
}

/**
 * How many places a squad has going spare.
 *
 * A pending offer reserves a place, so it counts against capacity exactly as a
 * member does: without that, one free place would be offered to every eligible
 * family at once.
 *
 * Null means the squad has no capacity recorded, so no place can be said to
 * have "opened" and auto-offer stays out of it. Those clubs use manual offers
 * until they set a capacity.
 */
export function freePlaces(
  maxCapacity: number | null | undefined,
  memberCount: number,
  pendingOfferCount: number,
): number | null {
  if (maxCapacity === null || maxCapacity === undefined) {
    return null;
  }
  return Math.max(0, maxCapacity - memberCount - pendingOfferCount);
}

/**
 * Numbers the list. Position is derived, never stored, so a boost or a
 * withdrawal reorders everyone without touching a row. Entries that are no
 * longer in the running (enrolled, withdrawn, lapsed) have no position.
 */
export function withPositions<T extends WaitingListEntry>(
  entries: T[],
): Array<T & { position: number | null }> {
  const inTheRunning = new Set([WaitingListStatus.WAITING, WaitingListStatus.OFFERED]);
  const ordered = [...entries].sort(comparePriority);
  const positionByEntry = new Map<string, number>();
  let position = 0;
  for (const entry of ordered) {
    if (inTheRunning.has(entry.status)) {
      position += 1;
      positionByEntry.set(entry.entry_id, position);
    }
  }
  return entries.map((entry) => ({
    ...entry,
    position: positionByEntry.get(entry.entry_id) ?? null,
  }));
}
