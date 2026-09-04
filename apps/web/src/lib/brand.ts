/**
 * Single source of truth for product brand strings in the web app.
 *
 * The product name is not yet decided (TEM-5), so these values hold a
 * neutral placeholder. When the real name lands, changing this file
 * rebrands the whole app in one place.
 *
 * JSON files cannot import this module, so apps/web/public/manifest.json
 * and apps/web/public/site.webmanifest must be kept in sync by hand.
 */
export const BRAND = {
  /** Product name shown in headings, wordmarks and body copy. */
  name: 'Club Manager',
  /** Meta description for the app shell. */
  description: 'Club management platform for sports clubs',
  /** Alt text for the product logo image. */
  logoAlt: 'Club Manager',
  /** Copyright line rendered in page footers. */
  copyright: `${new Date().getFullYear()} Club Manager. All rights reserved.`,
} as const;
