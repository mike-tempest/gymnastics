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
