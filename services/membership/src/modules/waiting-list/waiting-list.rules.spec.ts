import { Discipline, SquadType, WaitingListStatus } from '@club-manager/shared-types';
import { Squad } from '../squads/entities/squad.entity';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import {
  ageInYearsAt,
  comparePriority,
  eligibilityProblem,
  freePlaces,
  isEligible,
  withPositions,
} from './waiting-list.rules';

/**
 * The rules that decide who gets the next place (TEM-22). These are the part
 * of the hero flow a club will be angriest about if it is wrong, so they are
 * tested directly rather than only through the engine.
 */

const NOW = new Date('2026-09-07T12:00:00Z');

function entry(overrides: Partial<WaitingListEntry> = {}): WaitingListEntry {
  return {
    entry_id: 'entry-1',
    club_id: 'club-1',
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
    club_id: 'club-1',
    squad_name: 'Recreational Gymnastics: Explore Group A',
    description: null,
    min_age: 6,
    max_age: 10,
    coach_name: null,
    training_times: null,
    max_capacity: 12,
    squad_type: SquadType.RECREATIONAL,
    level: null,
    discipline: Discipline.WOMENS_ARTISTIC,
    programme_flags: null,
    ...overrides,
  } as Squad;
}

describe('ageInYearsAt', () => {
  it('counts whole years', () => {
    expect(ageInYearsAt('2018-03-01', NOW)).toBe(8);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageInYearsAt('2018-12-31', NOW)).toBe(7);
  });

  it('counts a birthday that falls today', () => {
    expect(ageInYearsAt('2018-09-07', NOW)).toBe(8);
  });
});

describe('eligibilityProblem', () => {
  it('accepts a child inside the age range with no stated preferences', () => {
    expect(eligibilityProblem(entry(), squad(), NOW)).toBeNull();
  });

  it('refuses a child below the minimum age', () => {
    const problem = eligibilityProblem(entry({ child_dob: new Date('2022-01-01') }), squad(), NOW);
    expect(problem).toContain('Too young');
  });

  it('refuses a child above the maximum age', () => {
    const problem = eligibilityProblem(entry({ child_dob: new Date('2010-01-01') }), squad(), NOW);
    expect(problem).toContain('Too old');
  });

  it('accepts any age when the squad records no age range', () => {
    const openSquad = squad({ min_age: null, max_age: null });
    expect(isEligible(entry({ child_dob: new Date('1990-01-01') }), openSquad, NOW)).toBe(true);
  });

  it('refuses a squad in a discipline the family did not ask for', () => {
    const problem = eligibilityProblem(
      entry({ desired_discipline: Discipline.TRAMPOLINE }),
      squad(),
      NOW,
    );
    expect(problem).toBe('The class is in a different discipline');
  });

  it('ignores discipline when the family did not name one', () => {
    expect(isEligible(entry({ desired_discipline: null }), squad(), NOW)).toBe(true);
  });

  it('refuses a squad of the wrong type when the family named one', () => {
    const problem = eligibilityProblem(
      entry({ desired_squad_type: SquadType.COMPETITIVE }),
      squad(),
      NOW,
    );
    expect(problem).toBe('The class is of a different type');
  });

  it('treats a named preferred squad as a hard constraint', () => {
    const problem = eligibilityProblem(
      entry({ preferred_squad_id: 'a-different-squad' }),
      squad(),
      NOW,
    );
    expect(problem).toBe('The family asked for a different class');
  });

  it('refuses an entry that is not waiting', () => {
    const problem = eligibilityProblem(entry({ status: WaitingListStatus.OFFERED }), squad(), NOW);
    expect(problem).toContain('not waiting');
  });
});

describe('comparePriority', () => {
  it('puts a higher admin boost first, ahead of every other flag', () => {
    const boosted = entry({ entry_id: 'boosted', priority_boost: 5 });
    const sibling = entry({
      entry_id: 'sibling',
      is_existing_member_family: true,
      is_sibling: true,
      joined_at: new Date('2020-01-01T00:00:00Z'),
    });
    expect([sibling, boosted].sort(comparePriority)[0].entry_id).toBe('boosted');
  });

  it('puts an existing member family ahead of a stranger who waited longer', () => {
    const existing = entry({
      entry_id: 'existing',
      is_existing_member_family: true,
      joined_at: new Date('2026-06-01T00:00:00Z'),
    });
    const stranger = entry({ entry_id: 'stranger', joined_at: new Date('2020-01-01T00:00:00Z') });
    expect([stranger, existing].sort(comparePriority)[0].entry_id).toBe('existing');
  });

  it('puts a sibling ahead of a non-sibling at the same level', () => {
    const sibling = entry({ entry_id: 'sibling', is_sibling: true });
    const other = entry({ entry_id: 'other' });
    expect([other, sibling].sort(comparePriority)[0].entry_id).toBe('sibling');
  });

  it('falls back to how long they have waited', () => {
    const early = entry({ entry_id: 'early', joined_at: new Date('2025-01-01T00:00:00Z') });
    const late = entry({ entry_id: 'late', joined_at: new Date('2026-01-01T00:00:00Z') });
    expect([late, early].sort(comparePriority)[0].entry_id).toBe('early');
  });
});

describe('freePlaces', () => {
  it('subtracts members and pending offers from the capacity', () => {
    expect(freePlaces(12, 9, 2)).toBe(1);
  });

  it('counts a pending offer as a taken place, so one place is never double offered', () => {
    expect(freePlaces(10, 9, 1)).toBe(0);
  });

  it('never goes negative when a squad is over its capacity', () => {
    expect(freePlaces(8, 10, 0)).toBe(0);
  });

  it('returns null when the squad records no capacity at all', () => {
    expect(freePlaces(null, 5, 0)).toBeNull();
    expect(freePlaces(undefined, 5, 0)).toBeNull();
  });
});

describe('withPositions', () => {
  it('numbers the live list in priority order', () => {
    const rows = [
      entry({ entry_id: 'third', joined_at: new Date('2026-03-01T00:00:00Z') }),
      entry({ entry_id: 'first', priority_boost: 3 }),
      entry({ entry_id: 'second', joined_at: new Date('2026-02-01T00:00:00Z') }),
    ];

    const byId = new Map(withPositions(rows).map((row) => [row.entry_id, row.position]));

    expect(byId.get('first')).toBe(1);
    expect(byId.get('second')).toBe(2);
    expect(byId.get('third')).toBe(3);
  });

  it('gives no position to entries that are out of the running', () => {
    const rows = [
      entry({ entry_id: 'waiting' }),
      entry({ entry_id: 'enrolled', status: WaitingListStatus.ENROLLED }),
      entry({ entry_id: 'withdrawn', status: WaitingListStatus.WITHDRAWN }),
    ];

    const byId = new Map(withPositions(rows).map((row) => [row.entry_id, row.position]));

    expect(byId.get('waiting')).toBe(1);
    expect(byId.get('enrolled')).toBeNull();
    expect(byId.get('withdrawn')).toBeNull();
  });

  it('counts an entry holding an offer, so it keeps its place while it decides', () => {
    const rows = [
      entry({ entry_id: 'offered', status: WaitingListStatus.OFFERED }),
      entry({ entry_id: 'waiting', joined_at: new Date('2026-06-01T00:00:00Z') }),
    ];

    const byId = new Map(withPositions(rows).map((row) => [row.entry_id, row.position]));

    expect(byId.get('offered')).toBe(1);
    expect(byId.get('waiting')).toBe(2);
  });

  it('leaves the input order alone', () => {
    const rows = [entry({ entry_id: 'b' }), entry({ entry_id: 'a', priority_boost: 9 })];
    expect(withPositions(rows).map((row) => row.entry_id)).toEqual(['b', 'a']);
  });
});
