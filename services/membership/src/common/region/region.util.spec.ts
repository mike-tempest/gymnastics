import { REGION_CONFIG, isValidTimezoneForCountry, regionForCountry } from './region.util';
import { currencyForCountry } from '../currency/currency.util';

describe('region.util', () => {
  describe('REGION_CONFIG', () => {
    // Table-driven check of every supported market: currency, locale, the
    // default timezone, and the full timezone list.
    const cases: Array<{
      country: string;
      currency: string;
      locale: string;
      defaultTimezone: string;
      timezones: string[];
    }> = [
      {
        country: 'GB',
        currency: 'GBP',
        locale: 'en-GB',
        defaultTimezone: 'Europe/London',
        timezones: ['Europe/London'],
      },
      {
        country: 'US',
        currency: 'USD',
        locale: 'en-US',
        defaultTimezone: 'America/New_York',
        timezones: [
          'America/New_York',
          'America/Chicago',
          'America/Denver',
          'America/Phoenix',
          'America/Los_Angeles',
          'America/Anchorage',
          'Pacific/Honolulu',
        ],
      },
      {
        country: 'CA',
        currency: 'CAD',
        locale: 'en-CA',
        defaultTimezone: 'America/St_Johns',
        timezones: [
          'America/St_Johns',
          'America/Halifax',
          'America/Toronto',
          'America/Winnipeg',
          'America/Edmonton',
          'America/Vancouver',
        ],
      },
      {
        country: 'AU',
        currency: 'AUD',
        locale: 'en-AU',
        defaultTimezone: 'Australia/Sydney',
        timezones: [
          'Australia/Sydney',
          'Australia/Melbourne',
          'Australia/Brisbane',
          'Australia/Adelaide',
          'Australia/Perth',
          'Australia/Hobart',
          'Australia/Darwin',
        ],
      },
      {
        country: 'IE',
        currency: 'EUR',
        locale: 'en-IE',
        defaultTimezone: 'Europe/Dublin',
        timezones: ['Europe/Dublin'],
      },
    ];

    it.each(cases)(
      '$country maps to $currency / $locale / $defaultTimezone',
      ({ country, currency, locale, defaultTimezone, timezones }) => {
        const config = REGION_CONFIG[country];
        expect(config).toBeDefined();
        expect(config.currency).toBe(currency);
        expect(config.locale).toBe(locale);
        expect(config.defaultTimezone).toBe(defaultTimezone);
        expect(config.timezones).toEqual(timezones);
      },
    );

    it('uses the first timezone in the list as the default for every country', () => {
      for (const config of Object.values(REGION_CONFIG)) {
        expect(config.defaultTimezone).toBe(config.timezones[0]);
      }
    });
  });

  describe('regionForCountry', () => {
    it.each(['GB', 'US', 'CA', 'AU', 'IE'])('returns the %s config for %s', (country) => {
      expect(regionForCountry(country)).toBe(REGION_CONFIG[country]);
    });

    it('is case-insensitive', () => {
      expect(regionForCountry('us')).toBe(REGION_CONFIG.US);
      expect(regionForCountry('aU')).toBe(REGION_CONFIG.AU);
    });

    it('falls back to GB for an unknown country', () => {
      expect(regionForCountry('FR')).toBe(REGION_CONFIG.GB);
      expect(regionForCountry('ZZ')).toBe(REGION_CONFIG.GB);
    });

    it('falls back to GB when the country is absent', () => {
      expect(regionForCountry()).toBe(REGION_CONFIG.GB);
      expect(regionForCountry(null)).toBe(REGION_CONFIG.GB);
      expect(regionForCountry('')).toBe(REGION_CONFIG.GB);
    });
  });

  describe('isValidTimezoneForCountry', () => {
    it.each([
      ['GB', 'Europe/London', true],
      ['GB', 'America/Chicago', false],
      ['US', 'America/Phoenix', true],
      ['US', 'Australia/Sydney', false],
      ['CA', 'America/Vancouver', true],
      ['AU', 'Australia/Perth', true],
      ['AU', 'Europe/London', false],
      ['IE', 'Europe/Dublin', true],
      ['IE', 'Europe/London', false],
    ])('%s + %s -> %s', (country, timezone, expected) => {
      expect(isValidTimezoneForCountry(country as string, timezone as string)).toBe(expected);
    });

    it('validates against the GB list for unknown or absent countries', () => {
      expect(isValidTimezoneForCountry('ZZ', 'Europe/London')).toBe(true);
      expect(isValidTimezoneForCountry(undefined, 'Europe/London')).toBe(true);
      expect(isValidTimezoneForCountry(null, 'America/Chicago')).toBe(false);
    });
  });

  describe('currencyForCountry delegates to the region config', () => {
    it.each([
      ['GB', 'GBP'],
      ['US', 'USD'],
      ['CA', 'CAD'],
      ['AU', 'AUD'],
      ['IE', 'EUR'],
    ])('%s resolves to %s', (country, currency) => {
      expect(currencyForCountry(country)).toBe(currency);
      expect(currencyForCountry(country)).toBe(REGION_CONFIG[country].currency);
    });

    it('keeps the GBP fallback for unknown or absent countries', () => {
      expect(currencyForCountry('ZZ')).toBe('GBP');
      expect(currencyForCountry()).toBe('GBP');
      expect(currencyForCountry(null)).toBe('GBP');
    });
  });
});
