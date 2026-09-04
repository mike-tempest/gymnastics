import {
  formatCurrencyIntl,
  formatDateIntl,
  formatDateTimeIntl,
} from '@/lib/utils/format-regional';
import { paymentMethodLabel } from '@/lib/utils/region-labels';

describe('formatCurrencyIntl', () => {
  it('matches the previous hardcoded UK formatting for GBP/en-GB', () => {
    expect(formatCurrencyIntl(33.95, 'GBP', 'en-GB')).toBe('£33.95');
    expect(formatCurrencyIntl('1250', 'GBP', 'en-GB')).toBe('£1,250.00');
  });

  it('formats USD, CAD, AUD and EUR with their locales', () => {
    expect(formatCurrencyIntl(1250, 'USD', 'en-US')).toBe('$1,250.00');
    expect(formatCurrencyIntl(50, 'CAD', 'en-CA')).toBe('$50.00');
    expect(formatCurrencyIntl(50, 'AUD', 'en-AU')).toBe('$50.00');
    expect(formatCurrencyIntl(50, 'EUR', 'en-IE')).toBe('€50.00');
  });
});

describe('formatDateIntl', () => {
  const date = new Date('2026-07-09T12:00:00Z');

  it('defaults to the day/short-month/year style used by billing.ts formatDate', () => {
    expect(formatDateIntl(date, 'en-GB')).toBe('9 Jul 2026');
  });

  it('renders month-first for a US locale', () => {
    expect(formatDateIntl(date, 'en-US')).toBe('Jul 9, 2026');
  });

  it('passes through explicit options', () => {
    // ICU versions differ on the comma after the weekday, so match both.
    expect(
      formatDateIntl(date, 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    ).toMatch(/^Thursday,? 9 July 2026$/);
  });
});

describe('formatDateIntl date-only handling', () => {
  it('renders calendar dates in UTC so they never shift with the viewer timezone', () => {
    expect(formatDateIntl('2026-08-01', 'en-US')).toBe('Aug 1, 2026');
    expect(formatDateIntl('2026-08-01T00:00:00.000Z', 'en-US')).toBe('Aug 1, 2026');
    expect(formatDateIntl('2026-08-01', 'en-GB')).toBe('1 Aug 2026');
    expect(
      formatDateIntl('2026-08-01', 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    ).toBe('01/08/2026');
  });
});

describe('formatDateTimeIntl', () => {
  it('shifts the rendered time into the given timezone', () => {
    const date = new Date('2026-07-09T17:00:00Z');
    expect(
      formatDateTimeIntl(date, 'en-US', 'America/Chicago', {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    ).toBe('12:00');
  });
});

describe('paymentMethodLabel', () => {
  it('names the bank payment method per country with a GB fallback', () => {
    expect(paymentMethodLabel('GB')).toBe('Direct Debit');
    expect(paymentMethodLabel('US')).toBe('ACH bank debit');
    expect(paymentMethodLabel('CA')).toBe('Pre-authorised debit');
    expect(paymentMethodLabel('AU')).toBe('Direct Debit');
    expect(paymentMethodLabel('IE')).toBe('Direct Debit');
    expect(paymentMethodLabel('FR')).toBe('Direct Debit');
    expect(paymentMethodLabel(undefined)).toBe('Direct Debit');
  });
});
