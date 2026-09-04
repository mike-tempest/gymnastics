/**
 * Club-aware formatting helpers for money and dates.
 *
 * Services building customer-facing strings (emails, descriptions) must use
 * these instead of hardcoded pound signs and 'en-GB' locales, passing the
 * club's stored currency, locale and timezone. With GBP/en-GB/Europe/London
 * the output is identical to the previous hardcoded formatting, so existing
 * UK clubs see no change.
 */

/**
 * Rounds a monetary amount to two decimal places, nudging by Number.EPSILON
 * first so values that land just below a half-cent boundary through binary
 * float representation (e.g. 1.005) still round up as a person would expect.
 */
export function roundTo2dp(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Formats a monetary amount in the club's currency and locale. */
export function formatMoney(amount: number | string, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/**
 * Formats a date in the club's locale and timezone. Defaults match the
 * numeric day/month/year style previously produced by
 * toLocaleDateString('en-GB').
 */
export function formatClubDate(
  date: Date | string,
  locale: string,
  timezone: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Date(date).toLocaleDateString(locale, {
    timeZone: timezone,
    ...(opts ?? {}),
  });
}

/**
 * Formats a date and time in the club's locale and timezone, matching the
 * style previously produced by toLocaleString('en-GB').
 */
export function formatClubDateTime(
  date: Date | string,
  locale: string,
  timezone: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Date(date).toLocaleString(locale, {
    timeZone: timezone,
    ...(opts ?? {}),
  });
}
