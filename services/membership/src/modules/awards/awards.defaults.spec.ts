import { AwardSchemeSource } from '@club-manager/shared-types';
import { DEFAULT_AWARD_SCHEMES } from './awards.defaults';
import { parseRiseCsv, splitCsv, toDateKey, toRiseCsv } from './awards.csv';

/**
 * Completeness checks on the starter scheme fixture and the CSV bridge.
 *
 * The fixture is the one place a scheme's shape is written down, so these
 * assertions guard the promise that installing it gives a club a coherent,
 * ordered catalogue rather than a half-built one.
 */
describe('default award schemes', () => {
  it('ships British Gymnastics Rise and the legacy Proficiency Awards', () => {
    const sources = DEFAULT_AWARD_SCHEMES.map((scheme) => scheme.source);
    expect(sources).toContain(AwardSchemeSource.BG_RISE);
    expect(sources).toContain(AwardSchemeSource.LEGACY_PROFICIENCY);
  });

  it('gives every scheme a name, a description and at least one level', () => {
    for (const scheme of DEFAULT_AWARD_SCHEMES) {
      expect(scheme.name.trim()).not.toBe('');
      expect(scheme.description.trim()).not.toBe('');
      expect(scheme.levels.length).toBeGreaterThan(0);
    }
  });

  it('uses a distinct name per scheme, so installing twice is detectable', () => {
    const names = DEFAULT_AWARD_SCHEMES.map((scheme) => scheme.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every level a unique name and a unique sort order within its scheme', () => {
    for (const scheme of DEFAULT_AWARD_SCHEMES) {
      const names = scheme.levels.map((level) => level.name);
      const orders = scheme.levels.map((level) => level.sort_order);

      expect(new Set(names).size).toBe(names.length);
      expect(new Set(orders).size).toBe(orders.length);
      expect(orders.every((order) => Number.isInteger(order) && order >= 0)).toBe(true);
    }
  });

  it('covers the three Rise journeys', () => {
    const rise = DEFAULT_AWARD_SCHEMES.find(
      (scheme) => scheme.source === AwardSchemeSource.BG_RISE,
    )!;
    const names = rise.levels.map((level) => level.name);

    for (const journey of ['Discover', 'Explore', 'Excel']) {
      expect(names.some((name) => name.startsWith(journey))).toBe(true);
    }
  });

  it('orders the Rise journeys Discover, then Explore, then Excel', () => {
    const rise = DEFAULT_AWARD_SCHEMES.find(
      (scheme) => scheme.source === AwardSchemeSource.BG_RISE,
    )!;
    const ordered = [...rise.levels].sort((a, b) => a.sort_order - b.sort_order);
    const journeys = ordered.map((level) => level.name.split(' ')[0]);
    const firstIndexOf = (journey: string) => journeys.indexOf(journey);

    expect(firstIndexOf('Discover')).toBeLessThan(firstIndexOf('Explore'));
    expect(firstIndexOf('Explore')).toBeLessThan(firstIndexOf('Excel'));
  });

  it('leaves fees unset, so a club prices its own badges', () => {
    for (const scheme of DEFAULT_AWARD_SCHEMES) {
      for (const level of scheme.levels) {
        expect(level).not.toHaveProperty('badge_fee');
        expect(level).not.toHaveProperty('certificate_fee');
      }
    }
  });

  it('grades the legacy Proficiency Awards from Award 8 up to Award 1', () => {
    const proficiency = DEFAULT_AWARD_SCHEMES.find(
      (scheme) => scheme.source === AwardSchemeSource.LEGACY_PROFICIENCY,
    )!;
    const numbered = proficiency.levels
      .filter((level) => level.name.startsWith('Proficiency Award '))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((level) => Number(level.name.replace('Proficiency Award ', '')));

    expect(numbered).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });
});

describe('Rise CSV helpers', () => {
  it('round-trips rows through the exporter and the parser', () => {
    const rows = [
      {
        first_name: 'Ava',
        last_name: 'Nolan',
        dob: '2016-04-02',
        bg_membership_number: '1234567',
        scheme: 'British Gymnastics Rise',
        level: 'Explore 3',
        award_date: '2026-09-01',
      },
    ];

    const parsed = parseRiseCsv(toRiseCsv(rows));

    expect(parsed.rows).toEqual(rows);
    expect(parsed.missingHeaders).toEqual([]);
    expect(parsed.unknownHeaders).toEqual([]);
  });

  it('quotes a field containing a comma and reads it back intact', () => {
    const csv = toRiseCsv([
      {
        first_name: 'Ava',
        last_name: 'Nolan, Jr',
        dob: '2016-04-02',
        bg_membership_number: '',
        scheme: 'Club "own" badges',
        level: 'Level 1',
        award_date: '2026-09-01',
      },
    ]);

    expect(parseRiseCsv(csv).rows[0].last_name).toBe('Nolan, Jr');
    expect(parseRiseCsv(csv).rows[0].scheme).toBe('Club "own" badges');
  });

  it('accepts common header spellings a club spreadsheet uses', () => {
    const parsed = parseRiseCsv(
      [
        'First Name,Surname,Date of Birth,BG Number,Scheme,Badge,Award Date',
        'Ava,Nolan,02/04/2016,1234567,Rise,Explore 3,01/09/2026',
      ].join('\n'),
    );

    expect(parsed.missingHeaders).toEqual([]);
    expect(parsed.rows[0].bg_membership_number).toBe('1234567');
    expect(parsed.rows[0].level).toBe('Explore 3');
  });

  it('reports headers it did not recognise instead of silently dropping them', () => {
    const parsed = parseRiseCsv(['first_name,last_name,apparatus', 'Ava,Nolan,Bars'].join('\n'));

    expect(parsed.unknownHeaders).toEqual(['apparatus']);
    expect(parsed.missingHeaders).toContain('dob');
  });

  it('handles Windows line endings and a trailing blank line', () => {
    const grid = splitCsv('a,b\r\n1,2\r\n\r\n');
    expect(grid).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('reads UK day-first dates as well as ISO', () => {
    expect(toDateKey('02/04/2016')).toBe('2016-04-02');
    expect(toDateKey('2-4-2016')).toBe('2016-04-02');
    expect(toDateKey('2016-04-02')).toBe('2016-04-02');
    expect(toDateKey('2016-04-02T00:00:00.000Z')).toBe('2016-04-02');
  });

  it('returns null for a date it cannot read, rather than guessing', () => {
    expect(toDateKey('sometime in April')).toBeNull();
    expect(toDateKey('')).toBeNull();
    expect(toDateKey(null)).toBeNull();
  });
});
