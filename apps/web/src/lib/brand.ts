/**
 * Single source of truth for product brand strings in the web app.
 *
 * Product name and domain confirmed in TEM-5.
 *
 * JSON files cannot import this module, so apps/web/public/site.webmanifest
 * must be kept in sync by hand.
 */
const PRODUCT_NAME = 'Tumblebase';

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
  description: 'Gymnastics club management, Direct Debit billing and compliance in one place.',
  website: 'https://tumblebase.com',
  /** Copyright line rendered in page footers. */
  copyright: `${new Date().getFullYear()} ${PRODUCT_NAME}. All rights reserved.`,
} as const;
