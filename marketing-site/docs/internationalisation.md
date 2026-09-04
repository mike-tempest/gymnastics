# Internationalisation - Swimly Marketing Site

How the Swimly marketing site serves the United Kingdom, the United States,
Canada and Australia from a single Astro build, and how to extend it to a new
region. This is the reference for anyone touching regional pages, hreflang,
canonicals, sitemaps, or the deploy.

If you only remember one thing: per-page canonical and hreflang must come from
`src/config/regions.ts`. Never hard-code a region's host, price, currency, or
governing body in a page.

> **Status.** This document describes the target internationalisation
> architecture that the multi-part intl work is building, and the contract every
> part is built against. It is written in the present tense to describe how the
> finished system behaves and what each piece is responsible for, not to claim
> every piece has already landed on `main`. At the time of writing, the regional
> config lives on a feature branch (`feat/intl-01-region-config`), the base
> `Layout.astro` and the sitemaps still emit UK-only values, and `deploy-ftp.sh`
> still has a single swimly.uk target. Where a section needs to be precise about
> what is wired up today versus what the contract requires, it says so. Treat the
> behaviour below as the specification the pages, layout, sitemaps, and deploy
> must satisfy.

## Why two domains

Swimly runs on two domains on purpose.

- **swimly.uk** is the established United Kingdom site. It has years of SEO
  equity for British swimming-club queries and a country-code top-level domain
  (ccTLD) that Google treats as geo-locked to the UK. A `.uk` domain cannot be
  re-targeted to other countries in Google Search Console; the geographic
  signal is fixed. So the UK stays exactly where it is, at the root of
  swimly.uk, and we do not move or dilute it.
- **swimly.club** is a generic top-level domain (gTLD). A gTLD carries no
  built-in country signal, which means we can host several countries under it
  and set per-folder geographic targeting in Search Console (see
  `international-launch-checklist.md`). This is where the United States, Canada
  and Australia live.
- **swimly.info** is a second gTLD we own. It does not host content. It
  301-redirects to swimly.club, so the name is defensive only and never competes
  for the same rankings.

The short version: the UK keeps its ccTLD advantage on swimly.uk; everyone else
shares the neutral gTLD swimly.club, where each country gets its own folder and
its own geographic targeting.

## The URL model

One Astro project produces every page. Regions are expressed as path prefixes,
which matches how the pages sit on disk under `src/pages/`.

| Region | Host | Path prefix | Example page |
|--------|------|-------------|--------------|
| United Kingdom | https://swimly.uk | (none, root) | `https://swimly.uk/pricing/` |
| United States | https://swimly.club | `/us` | `https://swimly.club/us/pricing/` |
| Canada | https://swimly.club | `/ca` | `https://swimly.club/ca/pricing/` |
| Australia | https://swimly.club | `/au` | `https://swimly.club/au/pricing/` |

In addition there is an **international hub** built under `international/`. It is
a small set of pages on swimly.club that introduce Swimly to visitors who have
not landed on a specific country and route them to the right regional folder.
The hub is not a region: it has no entry in `REGIONS` and no per-folder
geographic targeting.

The site keeps Astro's `trailingSlash: 'always'`, so every internal link, every
canonical, and every hreflang URL ends in a slash.

## One build, deploy-split to two doc roots

There is a single `astro build`. It emits the whole tree into `dist.nosync/`
(the `.nosync` suffix stops iCloud Drive evicting files mid-upload; see
`astro.config.mjs`). Once the intl pages are in place, that one output contains:

- the UK pages at the root (`/`, `/pricing/`, `/features/`, `/blog/`,
  `/clubs/`, and so on), as it does today,
- the intl pages at their real paths (`/us/...`, `/ca/...`, `/au/...`),
- the hub under `international/`.

The intl pages and the hub live under `src/pages/us/`, `src/pages/ca/`,
`src/pages/au/` and `src/pages/international/`; they are added by the intl work,
not present on `main` yet.

At deploy time that one output is **split across two document roots**:

- the swimly.uk doc root receives the UK pages (the root content),
- the swimly.club doc root receives `us/`, `ca/`, `au/` and `international/`.

This is a deploy-time concern, not a build-time one. The build stays simple and
canonical correctness comes entirely from `regions.ts`, so a page is correct
wherever it is served from. The deploy gains new remote targets, configured by
secret (`FTP_REMOTE_CLUB`, and optionally `FTP_REMOTE_INFO` for the redirect
host); see `international-launch-checklist.md` for the go-live steps.

Deployment still happens only through `deploy-ftp.sh`, never raw lftp or FTP,
because of the umask permission fix that script applies. The system umask is
0077, so Astro's output is unreadable by the web server until the script runs
`chmod 755` on directories and `644` on files. Bypassing it has caused four 403
outages.

## The `src/config/regions.ts` contract

`src/config/regions.ts` is the single source of truth for everything
region-specific. Pages, the layout, and the sitemaps read from it, and nothing
duplicates its values. `src/utils/region.ts` is a thin re-export of the same
module, so `import ... from '../config/regions'` and `import ... from
'../utils/region'` resolve to the same thing. Both files currently live on the
`feat/intl-01-region-config` branch; the contract below is what the rest of the
intl work is built against.

### Shape

```ts
export type RegionKey = 'uk' | 'us' | 'ca' | 'au';

export interface Region {
  key: RegionKey;
  name: string;             // 'United Kingdom', 'United States', ...
  hreflang: string;         // 'en-GB', 'en-US', 'en-CA', 'en-AU'
  host: string;             // 'https://swimly.uk' or 'https://swimly.club'
  pathPrefix: string;       // '' for UK, '/us', '/ca', '/au'
  currency: string;         // 'GBP', 'USD', 'CAD', 'AUD'
  currencySymbol: string;   // '£', '$', 'C$', 'A$'
  pricePrimary: number;     // PROVISIONAL until confirmed before launch
  pricePerformance: number; // PROVISIONAL until confirmed before launch
  governingBody: string;    // 'Swim England', 'USA Swimming', ...
  spelling: 'gb' | 'us';    // 'us' for the US, 'gb' for UK/CA/AU
  appUrl: string;           // application sign-in URL for the region
  contactEmail: string;     // 'hello@swimly.uk' or 'hello@swimly.club'
}
```

### Constants

- `REGIONS: Record<RegionKey, Region>` - the full table of regions.
- `DEFAULT_REGION: RegionKey` - `'uk'`.
- `REGION_ORDER: RegionKey[]` - the order regions appear in hreflang clusters
  and any region switcher: `['uk', 'us', 'ca', 'au']`.
- `INTL_REGIONS: RegionKey[]` - the non-UK regions: `['us', 'ca', 'au']`.
- `GLOBAL_ROUTES: string[]` - routes that exist in every region and therefore
  form a reciprocal hreflang cluster: `['/', '/pricing/', '/features/']`.

### Helpers

- `regionFromPath(pathname)` - which region owns a built path. Matches a leading
  `/us`, `/ca` or `/au`; everything else is `'uk'`.
- `routeWithinRegion(pathname)` - strips the region prefix to get the
  region-agnostic route, for example `/us/pricing/` becomes `/pricing/`.
- `canonicalFor(pathname)` - the absolute canonical URL for a page, built from
  the owning region's `host` plus the path (with a trailing slash). A UK page
  canonicalises to `https://swimly.uk/...`; a US page to
  `https://swimly.club/us/...`.
- `hreflangCluster(route)` - for a global route, returns the reciprocal set of
  `{ hreflang, href }` links across every region in `REGION_ORDER`, plus an
  `x-default` pointing at the UK host. Used to emit `<link rel="alternate">`
  tags.
- `formatPrice(region, amount)` - formats an amount with the region's currency
  symbol for visible copy. Never hard-code a currency symbol in a page; call
  this.

Because `host` is part of the contract, a page does not need to know which doc
root it will be deployed to. `canonicalFor` and `hreflangCluster` produce the
correct absolute URLs from `regions.ts` alone, which is what makes the
deploy-split safe.

## How the layout and sitemaps consume the config

### Layout (`src/layouts/Layout.astro`)

The layout is responsible for deriving the current page's region from its
pathname and emitting the region-aware head tags. The contract is:

- **Canonical.** `canonicalFor(Astro.url.pathname)` sets `<link
  rel="canonical">`. Region-only pages (pages that exist in just one region, for
  example a US-specific governing-body answer page) self-canonicalise to their
  own URL on their own host. They do not point at a UK equivalent, because there
  is not one.
- **Hreflang.** For a page whose region-agnostic route is in `GLOBAL_ROUTES`,
  the layout emits the full reciprocal `hreflangCluster(route)` plus
  `x-default`. Pages that are not global routes emit no hreflang at all (a
  single-region page has no alternates to declare).
- **Region-specific copy.** Visible copy that varies by region (currency, prices
  via `formatPrice`, the governing body, the contact email, the app sign-in URL)
  is read from the region's entry in `REGIONS`, never inlined.
- The existing JSON-LD (`SoftwareApplication`, `Organization`) and the optional
  `FAQPage` schema keep working; the region-aware values flow through the same
  way.

**Current state.** The base `Layout.astro` on `main` is still UK-only: it
hard-codes `https://swimly.uk`, computes the canonical inline from that constant
(it does not yet import `canonicalFor`), emits no hreflang tags, and fixes the
document language to `en-GB` and the organisation contact to `hello@swimly.uk`.
Wiring it to `regions.ts` per the contract above is part of the intl work, not
something the page author should assume already happens. Until it lands, an
international page must not rely on the layout to produce its canonical or
hreflang automatically.

### Sitemaps (`src/pages/sitemap-*.xml.ts`)

The site builds several sitemaps and one index:

- `sitemap-core.xml.ts`, `sitemap-blog.xml.ts`, `sitemap-clubs.xml.ts`,
  `sitemap-towns.xml.ts`, gathered by `sitemap-index.xml.ts`.

Two rules keep them correct across regions:

1. **A URL must appear in the sitemap of the host that actually serves it.** UK
   URLs (swimly.uk) and swimly.club URLs (`/us`, `/ca`, `/au`, plus the hub)
   each belong under the right host in the right doc root: the sitemap index
   served from the swimly.club doc root references swimly.club URLs, and the one
   served from the swimly.uk doc root references swimly.uk URLs. Build absolute
   URLs from `REGIONS[...].host` and the path, not from a single hard-coded base.
2. **Do not regenerate the programmatic clubs and towns generators** as part of
   internationalisation. They produce thousands of UK pages and are out of scope
   for the intl work unless a change is explicitly about them.

**Current state.** Every sitemap file (`sitemap-index`, `-core`, `-blog`,
`-clubs`, `-towns`) currently hard-codes `const baseUrl = 'https://swimly.uk'`
and emits only swimly.uk URLs, so no swimly.club sitemap exists yet. Making the
base region-aware so the swimly.club doc root gets its own sitemap index and
`/us`, `/ca`, `/au` URLs is part of the intl work. The launch checklist covers
submitting `https://swimly.club/sitemap-index.xml` to Search Console once that
sitemap is produced.

## Hreflang and canonical rules (summary)

- **UK is self-canonical on swimly.uk.** Nothing about internationalisation
  changes UK canonicals or moves UK URLs. Preserving swimly.uk SEO is the first
  constraint.
- **Intl pages are self-canonical on swimly.club** at their `/us`, `/ca` or
  `/au` path. They never canonicalise to the UK.
- **Global routes** (`/`, `/pricing/`, `/features/`) form a reciprocal hreflang
  cluster across all four regions, with `x-default` pointing at the UK. Every
  page in the cluster lists every other page in the cluster, including itself
  (reciprocity is what Google validates).
- **Region-only pages** (anything outside `GLOBAL_ROUTES`) self-canonicalise and
  emit no hreflang.
- **swimly.info** never serves canonical content; it 301-redirects to
  swimly.club, so it should never appear in a canonical or hreflang tag.
- **Trailing slashes everywhere.** Canonicals and hreflang hrefs all end in `/`,
  matching `trailingSlash: 'always'`.

## How to add a new region

The config is designed so a new English-language region is mostly a data change.
To add, for example, New Zealand (`nz`):

1. **Extend the type and table in `src/config/regions.ts`.**
   - Add `'nz'` to `RegionKey`.
   - Add an `nz` entry to `REGIONS` with the host (`https://swimly.club`),
     `pathPrefix: '/nz'`, `hreflang: 'en-NZ'`, the correct currency and symbol,
     real (not placeholder) prices once known, the governing body (Swimming New
     Zealand), `spelling` (`'gb'` for Commonwealth English), the app URL and
     `hello@swimly.club`.
   - Add `'nz'` to `REGION_ORDER` and `INTL_REGIONS`.
2. **Create the pages** under `src/pages/nz/` for at least the global routes
   (`/`, `/pricing/`, `/features/`). Reuse the shared components and read every
   region-specific value from `REGIONS.nz`; do not fork copy unnecessarily. Mind
   the spelling rule for the region (American only for the US; Commonwealth for
   the rest).
3. **Add the hub link** so the new region is reachable from `international/`.
4. **Confirm hreflang.** Because the new region is in `REGION_ORDER`, the
   `hreflangCluster` helper automatically includes it in the cluster for every
   global route, on every region's page. Build and spot-check that the new
   `en-NZ` alternate appears reciprocally.
5. **Deploy and Search Console.** The new folder ships to the swimly.club doc
   root by the same deploy-split. In Search Console, set per-folder
   international targeting for `/nz` to New Zealand and re-submit the swimly.club
   sitemap index. See `international-launch-checklist.md`.
6. **House style and facts.** Use real geography and the real governing body.
   Never invent clubs, member counts, or statistics for the new market. The SEO
   engine's "no fabricated facts" rule applies to every region (see
   `seo-aeo-engine.md`).

## Related docs

- `international-launch-checklist.md` - the concrete go-live runbook (DNS, doc
  roots, secrets, mailbox, Search Console, redirect, hreflang validation,
  security).
- `seo-aeo-engine.md` - the daily SEO/AEO engine, now region-aware.
- `seo-aeo-ledger.md` - the engine's backlog, including the international
  section.
