/**
 * Single source of truth for product brand strings in the web app.
 *
 * The product name is not yet decided (TEM-5), so these values hold a
 * neutral placeholder. When the real name lands, changing this file
 * rebrands the whole app in one place.
 *
 * JSON files cannot import this module, so apps/web/public/site.webmanifest
 * must be kept in sync by hand.
 */
const PRODUCT_NAME = 'Club Manager';

/**
 * Display noun for the core Member entity. Code says Member everywhere;
 * parents and coaches say "Gymnast". All user-facing copy must go through
 * these constants so a future sport is a one-line change here.
 * Lowercase and possessive forms are derived, never hard-coded.
 */
export const MEMBER_NOUN = 'Gymnast';
export const MEMBER_NOUN_PLURAL = 'Gymnasts';
export const MEMBER_NOUN_LOWER = MEMBER_NOUN.toLowerCase();
export const MEMBER_NOUN_PLURAL_LOWER = MEMBER_NOUN_PLURAL.toLowerCase();

export const BRAND = {
  /** Product name shown in headings, wordmarks and body copy. */
  name: PRODUCT_NAME,
  /** Meta description for the app shell. */
  description: 'Club management platform for sports clubs',
  /** Copyright line rendered in page footers. */
  copyright: `${new Date().getFullYear()} ${PRODUCT_NAME}. All rights reserved.`,
} as const;
