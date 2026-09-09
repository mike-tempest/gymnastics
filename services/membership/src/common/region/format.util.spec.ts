import { formatClubDate, formatClubDateTime, formatMoney, roundTo2dp } from './format.util';
import { REGION_CONFIG, regionForCountry } from './region.util';

describe('roundTo2dp', () => {
  it('rounds to two decimal places', () => {
    expect(roundTo2dp(2.749725)).toBe(2.75);
    expect(roundTo2dp(8.25)).toBe(8.25);
    expect(roundTo2dp(108.25)).toBe(108.25);
  });

  it('leaves whole and 2dp amounts unchanged', () => {
    expect(roundTo2dp(100)).toBe(100);
    expect(roundTo2dp(0)).toBe(0);
  });

  it('nudges half-cent float representations up as expected', () => {
    // 1.005 is stored just below the boundary in binary float; the epsilon
    // nudge makes it round to 1.01 rather than 1.
    expect(roundTo2dp(1.005)).toBe(1.01);
  });
});

describe('formatMoney', () => {
  it('matches the previous hardcoded UK formatting for GBP/en-GB', () => {
    expect(formatMoney(33.95, 'GBP', 'en-GB')).toBe('£33.95');
    expect(formatMoney('1250', 'GBP', 'en-GB')).toBe('£1,250.00');
  });

  it('formats USD for a US club', () => {
    expect(formatMoney(1250, 'USD', 'en-US')).toBe('$1,250.00');
  });

  it('formats CAD and AUD with their locales', () => {
    expect(formatMoney(50, 'CAD', 'en-CA')).toBe('$50.00');
    expect(formatMoney(50, 'AUD', 'en-AU')).toBe('$50.00');
  });

  it('formats EUR for an Irish club', () => {
    expect(formatMoney(50, 'EUR', 'en-IE')).toBe('€50.00');
  });
});

describe('formatClubDate', () => {
  const date = new Date('2026-07-09T12:00:00Z');

  it('matches the previous en-GB default output', () => {
    expect(formatClubDate(date, 'en-GB', 'Europe/London')).toBe(date.toLocaleDateString('en-GB'));
  });

  it('renders month-first for a US club', () => {
    expect(formatClubDate(date, 'en-US', 'America/New_York')).toBe('7/9/2026');
  });

  it('respects the club timezone across the date line', () => {
    const lateEvening = new Date('2026-07-09T22:00:00Z');
    expect(formatClubDate(lateEvening, 'en-AU', 'Australia/Sydney')).toBe('10/07/2026');
  });

  it('passes through explicit options', () => {
    expect(
      formatClubDate(date, 'en-GB', 'Europe/London', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    ).toBe('9 July 2026');
  });
});

describe('formatClubDateTime', () => {
  it('shifts the rendered time into the club timezone', () => {
    const date = new Date('2026-07-09T17:00:00Z');
    expect(
      formatClubDateTime(date, 'en-US', 'America/Chicago', {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    ).toBe('12:00');
  });
});

describe('region payment method config', () => {
  it('maps every supported country to a GoCardless scheme and label', () => {
    expect(REGION_CONFIG.GB.directDebitScheme).toBe('bacs');
    expect(REGION_CONFIG.US.directDebitScheme).toBe('ach');
    expect(REGION_CONFIG.CA.directDebitScheme).toBe('pad');
    expect(REGION_CONFIG.AU.directDebitScheme).toBe('becs');
    expect(REGION_CONFIG.IE.directDebitScheme).toBe('sepa_core');
    expect(REGION_CONFIG.US.paymentMethodLabel).toBe('ACH bank debit');
    expect(REGION_CONFIG.CA.paymentMethodLabel).toBe('Pre-authorised debit');
  });

  it('falls back to the GB scheme for unknown countries', () => {
    expect(regionForCountry('FR').directDebitScheme).toBe('bacs');
    expect(regionForCountry(undefined).paymentMethodLabel).toBe('Direct Debit');
  });
});
