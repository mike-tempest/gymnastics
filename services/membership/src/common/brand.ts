/**
 * Single source of truth for the product brand name in the membership
 * service. The product name is not yet decided (TEM-5), so this holds a
 * neutral placeholder; when the real name lands, changing this file
 * rebrands every email and PDF in one place.
 *
 * The web app has its own copy in apps/web/src/lib/brand.ts; keep the
 * two values in sync.
 */
export const BRAND = {
  /** Product name used in email wordmarks, subjects and PDF footers. */
  name: 'Club Manager',
} as const;

/**
 * Display noun for the core Member entity in service-generated copy
 * (emails, safeguarding templates). Code says Member everywhere; parents
 * and coaches say "Gymnast". Keep in sync with apps/web/src/lib/brand.ts.
 */
export const MEMBER_NOUN = 'Gymnast';
export const MEMBER_NOUN_PLURAL = 'Gymnasts';
export const MEMBER_NOUN_LOWER = MEMBER_NOUN.toLowerCase();
export const MEMBER_NOUN_PLURAL_LOWER = MEMBER_NOUN_PLURAL.toLowerCase();
