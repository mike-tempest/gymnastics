/**
 * Bank-debit scheme per country, mirroring the backend REGION_CONFIG
 * directDebitScheme values in services/membership/src/common/region/region.util.ts.
 * The scheme drives customer-facing protection copy: Bacs clubs cite the
 * Direct Debit Guarantee, BECS clubs cite the Direct Debit Request Service
 * Agreement, and the remaining schemes use neutral wording.
 */

import { SUPPORTED_COUNTRIES, type SupportedCountry } from './region-labels';

export type DirectDebitScheme = 'bacs' | 'ach' | 'pad' | 'becs' | 'sepa_core';

const SCHEMES: Record<SupportedCountry, DirectDebitScheme> = {
  GB: 'bacs',
  IE: 'sepa_core',
  US: 'ach',
  CA: 'pad',
  AU: 'becs',
};

/** Scheme for a country; unknown or missing countries fall back to GB (Bacs). */
export function directDebitScheme(country?: string): DirectDebitScheme {
  const code = (SUPPORTED_COUNTRIES as readonly string[]).includes(country ?? '')
    ? (country as SupportedCountry)
    : 'GB';
  return SCHEMES[code];
}
