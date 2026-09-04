/**
 * Per-country regional defaults for the markets Swimly operates in.
 *
 * This is the single source of truth for how a club's country maps to its
 * billing currency, display locale, and the set of IANA timezones a club in
 * that country may choose from. Signup and settings both resolve their
 * defaults through this config, so adding a market means adding one entry
 * here.
 */
export interface RegionConfig {
  /** ISO 4217 default billing currency for the country. */
  currency: string;
  /** BCP 47 locale used for date/number formatting. */
  locale: string;
  /** The timezone applied when a club does not choose one explicitly. */
  defaultTimezone: string;
  /** IANA timezones a club in this country may select. */
  timezones: string[];
  /** GoCardless bank-debit scheme for the country. */
  directDebitScheme: 'bacs' | 'ach' | 'pad' | 'becs' | 'sepa_core';
  /** Customer-facing name for the recurring bank payment method. */
  paymentMethodLabel: string;
  /** Conventional customer-facing name of the tax (VAT, GST, Sales tax). */
  taxLabel: string;
  /**
   * Label for the club's tax registration identifier as it appears on tax
   * invoices (ABN for AU, VAT number for GB, GST/HST number for CA).
   */
  taxRegistrationLabel: string;
}

export const REGION_CONFIG: Record<string, RegionConfig> = {
  GB: {
    currency: 'GBP',
    locale: 'en-GB',
    defaultTimezone: 'Europe/London',
    timezones: ['Europe/London'],
    directDebitScheme: 'bacs',
    paymentMethodLabel: 'Direct Debit',
    taxLabel: 'VAT',
    taxRegistrationLabel: 'VAT number',
  },
  US: {
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
    directDebitScheme: 'ach',
    paymentMethodLabel: 'ACH bank debit',
    taxLabel: 'Sales tax',
    taxRegistrationLabel: 'Tax registration number',
  },
  CA: {
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
    directDebitScheme: 'pad',
    paymentMethodLabel: 'Pre-authorised debit',
    taxLabel: 'GST',
    taxRegistrationLabel: 'GST/HST number',
  },
  AU: {
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
    directDebitScheme: 'becs',
    paymentMethodLabel: 'Direct Debit',
    taxLabel: 'GST',
    taxRegistrationLabel: 'ABN',
  },
  IE: {
    currency: 'EUR',
    locale: 'en-IE',
    defaultTimezone: 'Europe/Dublin',
    timezones: ['Europe/Dublin'],
    directDebitScheme: 'sepa_core',
    paymentMethodLabel: 'Direct Debit',
    taxLabel: 'VAT',
    taxRegistrationLabel: 'VAT number',
  },
};

/**
 * Returns the regional config for a country code.
 *
 * @param country ISO 3166-1 alpha-2 code (case-insensitive). Optional.
 * @returns the matching config, or the GB config when the country is unknown
 * or absent, preserving the original UK-only behaviour for existing clubs.
 */
export function regionForCountry(country?: string | null): RegionConfig {
  if (!country) {
    return REGION_CONFIG.GB;
  }
  return REGION_CONFIG[country.toUpperCase()] ?? REGION_CONFIG.GB;
}

/**
 * Returns true when the timezone is a valid choice for the country. The
 * single check used by both signup (which falls back to the country default)
 * and settings updates (which reject invalid values with a 400).
 */
export function isValidTimezoneForCountry(
  country: string | null | undefined,
  timezone: string,
): boolean {
  return regionForCountry(country).timezones.includes(timezone);
}

/**
 * Returns the conventional tax label for a country (GB/IE 'VAT', AU/CA 'GST',
 * US 'Sales tax'), used to default a new club's tax_label at signup.
 *
 * Only the label is defaulted, never the rate: naming the tax costs nothing,
 * while defaulting a rate would wrongly tax clubs that are not registered for
 * GST/VAT. Unknown countries fall back to the GB label via regionForCountry,
 * so GB signups behave as the primary market.
 */
export function defaultTaxLabelForCountry(country?: string | null): string {
  return regionForCountry(country).taxLabel;
}

/**
 * Returns the customer-facing label for the club's tax registration
 * identifier (ABN for AU, VAT number for GB, GST/HST number for CA), used on
 * tax invoices alongside the stored tax_registration_number.
 */
export function taxRegistrationLabelForCountry(country?: string | null): string {
  return regionForCountry(country).taxRegistrationLabel;
}
