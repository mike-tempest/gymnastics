/**
 * Postal code and phone validation helpers.
 *
 * The parent portal has no per-country context yet, so postal codes are
 * validated against a union of the formats Swimly supports: GB, US, CA,
 * AU and IE. Phone validation is deliberately permissive international.
 */

const postalCodePatterns: RegExp[] = [
  // GB postcode, e.g. SW1A 1AA
  /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i,
  // US ZIP or ZIP+4, e.g. 90210 or 90210-1234
  /^[0-9]{5}(-[0-9]{4})?$/,
  // Canadian postal code, e.g. K1A 0B1 (space optional)
  /^[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]$/i,
  // Australian postcode, e.g. 2000
  /^[0-9]{4}$/,
  // Irish Eircode: routing key plus unique identifier, e.g. D08 XY00 (space optional)
  /^(D6W|[A-Z][0-9]{2})\s?[0-9A-Z]{4}$/i,
];

/**
 * Returns true when the trimmed value matches any supported postal format.
 * Blank values return false: callers that allow an empty optional field
 * must check for blank before calling this helper.
 */
export function isValidPostalCode(value: string): boolean {
  const trimmed = value.trim();
  return postalCodePatterns.some((pattern) => pattern.test(trimmed));
}

// Optional leading +, then only digits, spaces, hyphens and parentheses.
const phoneCharsPattern = /^\+?[0-9\s()-]+$/;

/**
 * Permissive international phone check: optional leading +, then 7 to 15
 * digits, allowing spaces, hyphens and parentheses between them.
 * Blank values return false: callers that allow an empty optional field
 * must check for blank before calling this helper.
 */
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!phoneCharsPattern.test(trimmed)) {
    return false;
  }
  const digits = trimmed.replace(/[^0-9]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
