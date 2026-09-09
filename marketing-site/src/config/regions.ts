// Region configuration for Swimly's multi-region marketing site.
//
// UK stays on swimly.uk (unchanged). US/CA/AU live on swimly.club under
// /us/, /ca/ and /au/. Canonical and hreflang values are derived PER PAGE
// from its path, so a single build can serve every region without harming
// swimly.uk SEO.
//
// SINGLE SOURCE OF TRUTH. This file unifies the three contracts the intl
// units drifted into during parallel development:
//   - Unit 1 (intl-01-region-config): business fields + formatPrice(region, amount)
//   - Unit 2 (intl-02-layouts):        locale + path/canonical/hreflang helpers
//   - Unit 7 (intl-07-nav-footer):     `label` field + regionHomeUrl()
// It is a superset of all three, so layouts, sitemaps, pricing and nav/footer
// all resolve against one shape. See the reconciliation notes at each section.

export type RegionKey = 'uk' | 'us' | 'ca' | 'au';

export interface RegionConfig {
  key: RegionKey;
  host: string;
  // Path prefix for the region. UK is the root (empty string); the
  // international regions are namespaced under /us, /ca and /au.
  pathPrefix: string;
  // Human-readable region name, e.g. for the region switcher and footer.
  // (Was `name` in Unit 1; standardised to `label` to match Unit 7's callers.)
  label: string;
  // BCP-47 locale, used for <html lang>, hreflang and Intl currency
  // formatting. (Was `hreflang` in Unit 1; standardised to `locale`.)
  locale: string;
  currency: string;
  currencySymbol: string;
  governingBody: string;
  contactEmail: string;
  appUrl: string;
  // PROVISIONAL pricing - confirm real figures before launch (carried over
  // from Unit 1, which flagged these as not yet final).
  pricePrimary: number;
  pricePerformance: number;
  // Copy spelling variant: 'gb' uses British spelling, 'us' American.
  spelling: 'gb' | 'us';
}

// Back-compat alias: a couple of importers reference the type as `Region`.
export type Region = RegionConfig;

export const DEFAULT_REGION: RegionKey = 'uk';

// Order used for hreflang clusters and any region listings.
export const REGION_ORDER: RegionKey[] = ['uk', 'us', 'ca', 'au'];

// International (non-UK) regions.
export const INTL_REGIONS: RegionKey[] = ['us', 'ca', 'au'];

// Routes that exist in every region and should therefore advertise a full
// hreflang cluster. These are matched against the region-relative path
// (see routeWithinRegion), so they are written without any region prefix.
export const GLOBAL_ROUTES: string[] = ['/', '/pricing/', '/features/'];

export const REGIONS: Record<RegionKey, RegionConfig> = {
  uk: {
    key: 'uk',
    host: 'https://swimly.uk',
    pathPrefix: '',
    label: 'United Kingdom',
    locale: 'en-GB',
    currency: 'GBP',
    currencySymbol: '£',
    governingBody: 'Swim England',
    contactEmail: 'hello@swimly.uk',
    appUrl: 'https://app.swimly.uk',
    pricePrimary: 29,
    pricePerformance: 49,
    spelling: 'gb',
  },
  us: {
    key: 'us',
    host: 'https://swimly.club',
    pathPrefix: '/us',
    label: 'United States',
    locale: 'en-US',
    currency: 'USD',
    currencySymbol: '$',
    governingBody: 'USA Swimming',
    contactEmail: 'hello@swimly.club',
    appUrl: 'https://app.swimly.uk',
    pricePrimary: 39,
    pricePerformance: 65,
    spelling: 'us',
  },
  ca: {
    key: 'ca',
    host: 'https://swimly.club',
    pathPrefix: '/ca',
    label: 'Canada',
    locale: 'en-CA',
    currency: 'CAD',
    currencySymbol: 'C$',
    governingBody: 'Swimming Canada',
    contactEmail: 'hello@swimly.club',
    appUrl: 'https://app.swimly.uk',
    pricePrimary: 49,
    pricePerformance: 85,
    spelling: 'gb',
  },
  au: {
    key: 'au',
    host: 'https://swimly.club',
    pathPrefix: '/au',
    label: 'Australia',
    locale: 'en-AU',
    currency: 'AUD',
    currencySymbol: 'A$',
    governingBody: 'Swimming Australia',
    contactEmail: 'hello@swimly.club',
    appUrl: 'https://app.swimly.uk',
    pricePrimary: 55,
    pricePerformance: 95,
    spelling: 'gb',
  },
};

// Normalise a pathname to a leading-slash, always-trailing-slash form so
// route comparisons are consistent with Astro's trailingSlash: 'always'.
function normalisePath(pathname: string): string {
  if (!pathname) return '/';
  let p = pathname;
  if (!p.startsWith('/')) p = `/${p}`;
  if (p !== '/' && !p.endsWith('/')) p = `${p}/`;
  return p;
}

// Determine which region a path belongs to from its prefix. Paths under
// /us, /ca or /au map to those regions; everything else is UK.
export function regionFromPath(pathname: string): RegionKey {
  const p = normalisePath(pathname);
  for (const key of INTL_REGIONS) {
    const prefix = REGIONS[key].pathPrefix; // e.g. "/us"
    if (p === `${prefix}/` || p.startsWith(`${prefix}/`)) {
      return key;
    }
  }
  return DEFAULT_REGION;
}

// Strip the region prefix from a path, returning the region-relative route.
// e.g. "/us/pricing/" -> "/pricing/", "/pricing/" -> "/pricing/",
// "/us/" -> "/".
export function routeWithinRegion(pathname: string): string {
  const p = normalisePath(pathname);
  const region = regionFromPath(p);
  const prefix = REGIONS[region].pathPrefix;
  if (!prefix) return p;
  const stripped = p.slice(prefix.length);
  return normalisePath(stripped || '/');
}

// Build the absolute URL for a region-relative route within a given region.
function urlForRegionRoute(region: RegionKey, route: string): string {
  const cfg = REGIONS[region];
  const r = normalisePath(route);
  const path = r === '/' ? `${cfg.pathPrefix}/` : `${cfg.pathPrefix}${r}`;
  return new URL(path, cfg.host).href;
}

// The canonical URL for a path is the path itself on its own region host.
export function canonicalFor(pathname: string): string {
  const region = regionFromPath(pathname);
  const route = routeWithinRegion(pathname);
  return urlForRegionRoute(region, route);
}

// Absolute home URL for a region (host + region prefix). Used by the
// region switcher and footer. (Unit 7 expected this helper; it existed in
// neither earlier version.)
export function regionHomeUrl(region: RegionKey): string {
  return urlForRegionRoute(region, '/');
}

// Build the full hreflang cluster for a region-relative route. Returns one
// entry per region (in REGION_ORDER) plus an x-default that points at the
// UK version, matching the previous single-region behaviour.
export function hreflangCluster(route: string): { hreflang: string; href: string }[] {
  const r = routeWithinRegion(route);
  const cluster = REGION_ORDER.map((region) => ({
    hreflang: REGIONS[region].locale,
    href: urlForRegionRoute(region, r),
  }));
  cluster.push({
    hreflang: 'x-default',
    href: urlForRegionRoute(DEFAULT_REGION, r),
  });
  return cluster;
}

// Format a price in a region's currency using its locale.
//
// Argument order is (region, amount) to match Unit 6's ~10 existing call
// sites (Price/Pricing/PricingValue/pricing.astro). Whole amounts render
// without trailing ".00"; fractional amounts keep two decimals.
export function formatPrice(region: RegionKey, amount: number): string {
  const cfg = REGIONS[region];
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
