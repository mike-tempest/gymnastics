import { localInstant, validDate, weeklyDates } from './timetable-calendar';

describe('club-local timetable dates', () => {
  it('keeps weekly wall time across British summer time', () => {
    expect(weeklyDates('2027-03-21', '2027-04-04', 0)).toEqual([
      '2027-03-21',
      '2027-03-28',
      '2027-04-04',
    ]);
    expect(localInstant('2027-03-21', '17:00', 'Europe/London').toISOString()).toBe(
      '2027-03-21T17:00:00.000Z',
    );
    expect(localInstant('2027-03-28', '17:00', 'Europe/London').toISOString()).toBe(
      '2027-03-28T16:00:00.000Z',
    );
  });
  it('rejects nonexistent and ambiguous British clock-change times', () => {
    expect(() => localInstant('2027-03-28', '01:30', 'Europe/London')).toThrow('does not exist');
    expect(() => localInstant('2027-10-31', '01:30', 'Europe/London')).toThrow('ambiguous');
  });
  it('validates real dates, inclusive boundaries and bounded terms', () => {
    expect(() => validDate('2027-02-29')).toThrow();
    expect(validDate('2028-02-29')).toBe('2028-02-29');
    expect(weeklyDates('2027-01-04', '2027-01-04', 1)).toEqual(['2027-01-04']);
    expect(() => weeklyDates('2027-01-04', '2026-01-04', 1)).toThrow();
    expect(() => weeklyDates('2027-01-04', '2029-01-04', 1)).toThrow();
  });
});
