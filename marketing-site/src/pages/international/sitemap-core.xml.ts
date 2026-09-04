import type { APIRoute } from 'astro';
import { GLOBAL_ROUTES, INTL_REGIONS, REGIONS } from '../../config/regions';

// Deploys to swimly.club/sitemap-core.xml (the international/ directory is
// mounted at the swimly.club root). Emits the shared core routes for every
// international region, e.g. https://swimly.club/us/, /us/pricing/, /us/features/.
//
// Location URLs (states/provinces) are added by other units via JSON data
// files in src/data. Those files may not exist yet, so we discover them with
// Vite's import.meta.glob, which resolves at build time and simply yields no
// matches when a file is absent. A plain runtime fs read does not work here:
// Astro bundles endpoints and runs them from a build chunk, so a relative
// path would not resolve back to src/data. See sitemap-clubs.xml.ts for the
// same build-time data-import pattern.

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

// Eagerly import any present location data files. import.meta.glob requires a
// static literal pattern; missing files simply do not appear in the result, so
// this never hard-fails when the data has not landed yet.
// TODO: location sitemaps — confirm the location route shape once the
// us-states.json / ca-provinces.json / au-states.json files land.
const locationModules = import.meta.glob<{ default: unknown }>(
  '../../data/{us-states,ca-provinces,au-states}.json',
  { eager: true }
);

// Map each intl region to the data file that holds its location slugs.
const LOCATION_FILE: Record<string, string> = {
  us: 'us-states.json',
  ca: 'ca-provinces.json',
  au: 'au-states.json',
};

/**
 * Resolve a region's location slugs from the eagerly-imported data modules,
 * returning [] when no data file is present for that region.
 *
 * Accepts an array of slug strings, an array of objects with a `slug` field,
 * or an object keyed by slug.
 */
function locationSlugsFor(regionKey: string): string[] {
  const fileName = LOCATION_FILE[regionKey];
  const moduleKey = Object.keys(locationModules).find((key) =>
    key.endsWith(`/${fileName}`)
  );
  if (!moduleKey) return [];

  const parsed = locationModules[moduleKey]?.default;
  const values = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? Object.keys(parsed as Record<string, unknown>)
      : [];

  const slugs: string[] = [];
  for (const value of values) {
    if (typeof value === 'string') {
      slugs.push(value);
    } else if (value && typeof value === 'object' && 'slug' in value) {
      const slug = (value as { slug?: unknown }).slug;
      if (typeof slug === 'string') slugs.push(slug);
    }
  }
  return slugs;
}

// City data files, for the /{region}/{state-or-province}/{city}/ pages.
// Same tolerant import.meta.glob pattern: a missing file yields no URLs.
const cityModules = import.meta.glob<{ default: unknown }>(
  '../../data/{us-cities,ca-cities,au-cities}.json',
  { eager: true }
);

const CITY_FILE: Record<string, string> = {
  us: 'us-cities.json',
  ca: 'ca-cities.json',
  au: 'au-cities.json',
};

function cityRoutesFor(regionKey: string): string[] {
  const fileName = CITY_FILE[regionKey];
  const moduleKey = Object.keys(cityModules).find((key) =>
    key.endsWith(`/${fileName}`)
  );
  if (!moduleKey) return [];

  const parsed = cityModules[moduleKey]?.default;
  const values = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? Object.values(parsed as Record<string, unknown>)
      : [];

  const routes: string[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const city = value as { slug?: unknown; stateSlug?: unknown; provinceSlug?: unknown };
    const location = city.stateSlug ?? city.provinceSlug;
    if (typeof city.slug === 'string' && typeof location === 'string') {
      routes.push(`/${location}/${city.slug}/`);
    }
  }
  return routes;
}

// Static (non-dynamic) region pages: guides, compare pages, and anything
// else added under src/pages/{us,ca,au}/ later. Discovered from the page
// tree at build time (keys only; the pages are never imported), so new
// pages join the sitemap automatically. Dynamic routes (containing "[")
// are excluded because the states/cities sections above cover them, and
// the /clubs/ subtree is excluded because sitemap-clubs.xml owns it.
const staticPageModules = import.meta.glob('../{us,ca,au}/**/*.astro');

function staticRoutesFor(regionKey: string): string[] {
  const prefix = `../${regionKey}/`;
  const routes: string[] = [];
  for (const key of Object.keys(staticPageModules)) {
    if (!key.startsWith(prefix) || key.includes('[')) continue;
    let route = '/' + key.slice(prefix.length);
    route = route.endsWith('/index.astro')
      ? route.slice(0, -'index.astro'.length)
      : route === '/index.astro'
        ? '/'
        : route.replace(/\.astro$/, '/');
    if (route === '/' || route.startsWith('/clubs/')) continue;
    routes.push(route);
  }
  return routes.sort();
}

export const GET: APIRoute = async () => {
  const currentDate = new Date().toISOString().split('T')[0];
  const urls: SitemapUrl[] = [];

  // ── The swimly.club root hub (the international gateway page) ──────────
  urls.push({
    loc: `${REGIONS.us.host}/`,
    lastmod: currentDate,
    changefreq: 'monthly',
    priority: '0.8',
  });

  for (const key of INTL_REGIONS) {
    const region = REGIONS[key];
    const base = `${region.host}${region.pathPrefix}`;

    // ── Global core routes ────────────────────────────────────────────────
    for (const route of GLOBAL_ROUTES) {
      urls.push({
        loc: `${base}${route}`,
        lastmod: currentDate,
        changefreq: route === '/' ? 'weekly' : 'monthly',
        priority: route === '/' ? '1.0' : '0.9',
      });
    }

    // ── Static content pages (guides, compare, ...), from the page tree ──
    for (const route of staticRoutesFor(key)) {
      urls.push({
        loc: `${base}${route}`,
        lastmod: currentDate,
        changefreq: 'monthly',
        priority: '0.8',
      });
    }

    // ── Location pages (states / provinces), when data is present ──────────
    for (const slug of locationSlugsFor(key)) {
      urls.push({
        loc: `${base}/${slug}/`,
        lastmod: currentDate,
        changefreq: 'weekly',
        priority: '0.7',
      });
    }

    // ── City pages, when data is present ──────────────────────────────────
    for (const route of cityRoutesFor(key)) {
      urls.push({
        loc: `${base}${route}`,
        lastmod: currentDate,
        changefreq: 'monthly',
        priority: '0.6',
      });
    }
  }

  // ── Dedupe (e.g. /pricing/ appears in both GLOBAL_ROUTES and the page
  // tree) while preserving the first occurrence's metadata ────────────────
  const seen = new Set<string>();
  const deduped = urls.filter((url) => {
    if (seen.has(url.loc)) return false;
    seen.add(url.loc);
    return true;
  });
  urls.length = 0;
  urls.push(...deduped);

  // ── Build the XML ─────────────────────────────────────────────────────
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
