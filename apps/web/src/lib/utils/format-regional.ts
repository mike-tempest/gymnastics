/**
 * Pure regional formatting helpers. Components should normally use the
 * useFormatters() hook, which binds these to the club's region; these
 * functions exist for utilities and tests that already hold a locale.
 * With GBP/en-GB/Europe/London the output is identical to the previous
 * hardcoded formatting, so existing UK clubs see no change.
 */

/** Formats a monetary amount in the given currency and locale. */
export function formatCurrencyIntl(
  amount: number | string,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/**
 * True for values that represent a calendar date rather than an instant:
 * date-only strings ("2026-08-01") and UTC-midnight ISO strings, which is how
 * date columns arrive from the API. Both parse as midnight UTC, so rendering
 * them in a west-of-UTC browser timezone would shift them a day earlier.
 */
function isDateOnly(date: Date | string): boolean {
  return (
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}($|T00:00:00(\.000)?Z$)/.test(date)
  );
}

/**
 * Formats a date in the given locale. Defaults match the day/short-month/year
 * style previously produced by lib/utils/billing.ts formatDate. Calendar-date
 * inputs (see isDateOnly) are rendered in UTC so the stored date never shifts
 * with the viewer's timezone; instants keep the browser's timezone unless the
 * caller overrides timeZone in opts.
 */
export function formatDateIntl(
  date: Date | string,
  locale: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const baseOpts = opts ?? { day: 'numeric', month: 'short', year: 'numeric' };
  const resolvedOpts = isDateOnly(date) ? { timeZone: 'UTC', ...baseOpts } : baseOpts;
  return new Date(date).toLocaleDateString(locale, resolvedOpts);
}

/** Formats a date and time in the given locale and timezone. */
export function formatDateTimeIntl(
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
