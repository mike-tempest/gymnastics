import {
  countryName,
  countyLabel,
  defaultTimezoneForCountry,
  postcodeLabel,
  timezonesForCountry,
  TIMEZONES_BY_COUNTRY,
} from '@/lib/utils/region-labels';

describe('postcodeLabel', () => {
  it('returns the right label per country', () => {
    expect(postcodeLabel('GB')).toBe('Postcode');
    expect(postcodeLabel('IE')).toBe('Postcode');
    expect(postcodeLabel('US')).toBe('ZIP code');
    expect(postcodeLabel('CA')).toBe('Postal code');
    expect(postcodeLabel('AU')).toBe('Postcode');
  });

  it('falls back to the GB label for unknown or missing countries', () => {
    expect(postcodeLabel('FR')).toBe('Postcode');
    expect(postcodeLabel(undefined)).toBe('Postcode');
    expect(postcodeLabel('')).toBe('Postcode');
  });
});

describe('countyLabel', () => {
  it('returns the right label per country', () => {
    expect(countyLabel('GB')).toBe('County');
    expect(countyLabel('US')).toBe('State');
    expect(countyLabel('CA')).toBe('Province');
    expect(countyLabel('AU')).toBe('State or territory');
    expect(countyLabel('IE')).toBe('County');
  });

  it('falls back to the GB label for unknown or missing countries', () => {
    expect(countyLabel('DE')).toBe('County');
    expect(countyLabel(undefined)).toBe('County');
  });
});

describe('countryName', () => {
  it('returns the full name for each supported code', () => {
    expect(countryName('GB')).toBe('United Kingdom');
    expect(countryName('US')).toBe('United States');
    expect(countryName('CA')).toBe('Canada');
    expect(countryName('AU')).toBe('Australia');
    expect(countryName('IE')).toBe('Ireland');
  });

  it('falls back to United Kingdom for unknown or missing countries', () => {
    expect(countryName('NZ')).toBe('United Kingdom');
    expect(countryName(undefined)).toBe('United Kingdom');
  });
});

describe('TIMEZONES_BY_COUNTRY and timezonesForCountry', () => {
  it('has single-timezone lists for GB and IE', () => {
    expect(TIMEZONES_BY_COUNTRY.GB).toEqual(['Europe/London']);
    expect(TIMEZONES_BY_COUNTRY.IE).toEqual(['Europe/Dublin']);
  });

  it('lists US timezones with America/New_York first', () => {
    expect(timezonesForCountry('US')).toEqual([
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Phoenix',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
    ]);
  });

  it('lists CA timezones with America/St_Johns first', () => {
    expect(timezonesForCountry('CA')).toEqual([
      'America/St_Johns',
      'America/Halifax',
      'America/Toronto',
      'America/Winnipeg',
      'America/Edmonton',
      'America/Vancouver',
    ]);
  });

  it('lists AU timezones with Australia/Sydney first', () => {
    expect(timezonesForCountry('AU')).toEqual([
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Brisbane',
      'Australia/Adelaide',
      'Australia/Perth',
      'Australia/Hobart',
      'Australia/Darwin',
    ]);
  });

  it('falls back to the GB list for unknown or missing countries', () => {
    expect(timezonesForCountry('ES')).toEqual(['Europe/London']);
    expect(timezonesForCountry(undefined)).toEqual(['Europe/London']);
  });
});

describe('defaultTimezoneForCountry', () => {
  it('returns the first timezone for each country', () => {
    expect(defaultTimezoneForCountry('GB')).toBe('Europe/London');
    expect(defaultTimezoneForCountry('IE')).toBe('Europe/Dublin');
    expect(defaultTimezoneForCountry('US')).toBe('America/New_York');
    expect(defaultTimezoneForCountry('CA')).toBe('America/St_Johns');
    expect(defaultTimezoneForCountry('AU')).toBe('Australia/Sydney');
  });

  it('falls back to Europe/London for unknown countries', () => {
    expect(defaultTimezoneForCountry('BR')).toBe('Europe/London');
    expect(defaultTimezoneForCountry(undefined)).toBe('Europe/London');
  });
});
