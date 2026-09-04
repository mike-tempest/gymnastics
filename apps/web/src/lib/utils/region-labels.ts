/**
 * Pure regional label helpers keyed by ISO 3166-1 alpha-2 country code.
 * Every helper falls back to GB values for unknown or undefined countries so
 * existing UK clubs (and the pre-backend state where the country is not yet
 * known) behave exactly as before.
 */

export const SUPPORTED_COUNTRIES = ['GB', 'US', 'CA', 'AU', 'IE'] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

const POSTCODE_LABELS: Record<SupportedCountry, string> = {
  GB: 'Postcode',
  US: 'ZIP code',
  CA: 'Postal code',
  AU: 'Postcode',
  IE: 'Postcode',
};

const COUNTY_LABELS: Record<SupportedCountry, string> = {
  GB: 'County',
  US: 'State',
  CA: 'Province',
  AU: 'State or territory',
  IE: 'County',
};

const COUNTRY_NAMES: Record<SupportedCountry, string> = {
  GB: 'United Kingdom',
  US: 'United States',
  CA: 'Canada',
  AU: 'Australia',
  IE: 'Ireland',
};

/**
 * Customer-facing name for the recurring bank payment method. Mirrors the
 * backend REGION_CONFIG paymentMethodLabel values.
 */
const PAYMENT_METHOD_LABELS: Record<SupportedCountry, string> = {
  GB: 'Direct Debit',
  US: 'ACH bank debit',
  CA: 'Pre-authorised debit',
  AU: 'Direct Debit',
  IE: 'Direct Debit',
};

/**
 * Label for the club's tax registration identifier as it appears on tax
 * invoices. Mirrors the backend REGION_CONFIG taxRegistrationLabel values.
 */
const TAX_REGISTRATION_LABELS: Record<SupportedCountry, string> = {
  GB: 'VAT number',
  US: 'Tax registration number',
  CA: 'GST/HST number',
  AU: 'ABN',
  IE: 'VAT number',
};

/**
 * IANA timezones per country. The first entry is the default for new clubs
 * in that country.
 */
export const TIMEZONES_BY_COUNTRY: Record<SupportedCountry, readonly string[]> = {
  GB: ['Europe/London'],
  IE: ['Europe/Dublin'],
  US: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
  ],
  CA: [
    'America/St_Johns',
    'America/Halifax',
    'America/Toronto',
    'America/Winnipeg',
    'America/Edmonton',
    'America/Vancouver',
  ],
  AU: [
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Brisbane',
    'Australia/Adelaide',
    'Australia/Perth',
    'Australia/Hobart',
    'Australia/Darwin',
  ],
};

function toSupportedCountry(country?: string): SupportedCountry {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(country ?? '')
    ? (country as SupportedCountry)
    : 'GB';
}

/** Label for the postal-code field ("Postcode", "ZIP code", ...). */
export function postcodeLabel(country?: string): string {
  return POSTCODE_LABELS[toSupportedCountry(country)];
}

/** Label for the county-level region field ("County", "State", ...). */
export function countyLabel(country?: string): string {
  return COUNTY_LABELS[toSupportedCountry(country)];
}

/** Human-readable country name for a supported ISO code. */
export function countryName(country?: string): string {
  return COUNTRY_NAMES[toSupportedCountry(country)];
}

/** Name of the recurring bank payment method ("Direct Debit", "ACH bank debit", ...). */
export function paymentMethodLabel(country?: string): string {
  return PAYMENT_METHOD_LABELS[toSupportedCountry(country)];
}

/** Label for the tax registration identifier ("ABN", "VAT number", ...). */
export function taxRegistrationLabel(country?: string): string {
  return TAX_REGISTRATION_LABELS[toSupportedCountry(country)];
}

/** Timezones for a country; falls back to the GB list. */
export function timezonesForCountry(country?: string): readonly string[] {
  return TIMEZONES_BY_COUNTRY[toSupportedCountry(country)];
}

/** Default (first) timezone for a country. */
export function defaultTimezoneForCountry(country?: string): string {
  return timezonesForCountry(country)[0];
}
