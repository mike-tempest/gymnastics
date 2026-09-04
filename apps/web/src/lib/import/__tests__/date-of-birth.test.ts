import { expandTwoDigitYear, parseDateOfBirth } from '../date-of-birth';

describe('parseDateOfBirth', () => {
  it('accepts ISO dates', () => {
    expect(parseDateOfBirth('2015-03-14')).toBe('2015-03-14');
    expect(parseDateOfBirth('2015/03/14')).toBe('2015-03-14');
    expect(parseDateOfBirth('2015-3-4')).toBe('2015-03-04');
  });

  it('accepts day-first dates with four-digit years', () => {
    expect(parseDateOfBirth('14/03/2015')).toBe('2015-03-14');
    expect(parseDateOfBirth('4/3/2015')).toBe('2015-03-04');
    expect(parseDateOfBirth('14-03-2015')).toBe('2015-03-14');
    expect(parseDateOfBirth('14.03.2015')).toBe('2015-03-14');
  });

  it('reads genuinely ambiguous dates day-first', () => {
    // Both day and month are 12 or less: AU and UK read day first.
    expect(parseDateOfBirth('05/06/2015')).toBe('2015-06-05');
    expect(parseDateOfBirth('1/2/2010')).toBe('2010-02-01');
  });

  it('expands two-digit years with a pivot on the reference year', () => {
    expect(parseDateOfBirth('15/03/08', 2026)).toBe('2008-03-15');
    expect(parseDateOfBirth('15/03/26', 2026)).toBe('2026-03-15');
    expect(parseDateOfBirth('15/03/27', 2026)).toBe('1927-03-15');
    expect(parseDateOfBirth('15/03/98', 2026)).toBe('1998-03-15');
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateOfBirth('31/02/2015')).toBeNull();
    expect(parseDateOfBirth('32/01/2015')).toBeNull();
    expect(parseDateOfBirth('00/01/2015')).toBeNull();
    expect(parseDateOfBirth('2015-13-01')).toBeNull();
    expect(parseDateOfBirth('29/02/2015')).toBeNull();
  });

  it('accepts real leap days', () => {
    expect(parseDateOfBirth('29/02/2016')).toBe('2016-02-29');
  });

  it('rejects unrecognised or empty values', () => {
    expect(parseDateOfBirth('')).toBeNull();
    expect(parseDateOfBirth('  ')).toBeNull();
    expect(parseDateOfBirth('14th March 2015')).toBeNull();
    expect(parseDateOfBirth('2015-03-14T00:00:00Z')).toBeNull();
    expect(parseDateOfBirth('not a date')).toBeNull();
  });

  it('rejects years before 1900', () => {
    expect(parseDateOfBirth('01/01/1899')).toBeNull();
    expect(parseDateOfBirth('1899-01-01')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(parseDateOfBirth(' 14/03/2015 ')).toBe('2015-03-14');
  });
});

describe('expandTwoDigitYear', () => {
  it('pivots on the reference year', () => {
    expect(expandTwoDigitYear(0, 2026)).toBe(2000);
    expect(expandTwoDigitYear(26, 2026)).toBe(2026);
    expect(expandTwoDigitYear(27, 2026)).toBe(1927);
    expect(expandTwoDigitYear(99, 2026)).toBe(1999);
  });
});
