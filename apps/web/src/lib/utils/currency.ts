/**
 * Currency display helpers shared by money inputs across the app.
 */

/**
 * Symbol for an ISO 4217 currency code as rendered in the given locale,
 * resolved through Intl.NumberFormat parts. Examples: GBP with en-GB gives
 * "£"; AUD with en-AU gives "$"; AUD with en-GB gives "A$". Falls back to the
 * raw currency code when the runtime cannot format the pair.
 */
export function currencySymbol(currency: string, locale = 'en-GB'): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}
