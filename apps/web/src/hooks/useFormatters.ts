'use client';

import { useCallback } from 'react';

import { useClubRegion } from '@/hooks/useClubRegion';
import {
  formatCurrencyIntl,
  formatDateIntl,
  formatDateTimeIntl,
} from '@/lib/utils/format-regional';

export interface Formatters {
  /**
   * Formats an amount in the club's currency and locale. Pass a currency
   * override when the record carries its own (for example invoice.currency).
   */
  formatCurrency: (amount: number | string, currencyOverride?: string) => string;
  /** Formats a date in the club's locale (day/short-month/year by default). */
  formatDate: (date: Date | string, opts?: Intl.DateTimeFormatOptions) => string;
  /** Formats a date and time in the club's locale and timezone. */
  formatDateTime: (date: Date | string, opts?: Intl.DateTimeFormatOptions) => string;
}

/**
 * Club-region-bound formatters. Resolves to GB defaults (GBP, en-GB,
 * Europe/London) while the region is loading or unavailable, matching the
 * previous hardcoded behaviour.
 */
export function useFormatters(): Formatters {
  const { currency, locale, timezone } = useClubRegion();

  const formatCurrency = useCallback(
    (amount: number | string, currencyOverride?: string) =>
      formatCurrencyIntl(amount, currencyOverride || currency, locale),
    [currency, locale]
  );

  const formatDate = useCallback(
    (date: Date | string, opts?: Intl.DateTimeFormatOptions) => formatDateIntl(date, locale, opts),
    [locale]
  );

  const formatDateTime = useCallback(
    (date: Date | string, opts?: Intl.DateTimeFormatOptions) =>
      formatDateTimeIntl(date, locale, timezone, opts),
    [locale, timezone]
  );

  return { formatCurrency, formatDate, formatDateTime };
}
