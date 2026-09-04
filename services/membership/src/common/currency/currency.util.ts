import { regionForCountry } from '../region/region.util';

/**
 * Returns the default billing currency (ISO 4217) for a country code.
 *
 * Delegates to the regional config in src/common/region/region.util.ts, which
 * is the single source of truth for per-country defaults (currency, locale,
 * timezones). Kept as a named export so existing call sites are unchanged.
 *
 * @param country ISO 3166-1 alpha-2 code (case-insensitive). Defaults to GB.
 * @returns the matching currency code, or GBP when the country is unknown.
 */
export function currencyForCountry(country?: string | null): string {
  return regionForCountry(country).currency;
}
