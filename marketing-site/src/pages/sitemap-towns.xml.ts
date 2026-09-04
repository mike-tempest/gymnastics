import type { APIRoute } from 'astro';
import countiesData from '../data/counties.json';
import townsData from '../data/towns.json';

const baseUrl = 'https://swimly.uk';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

export const GET: APIRoute = async () => {
  const currentDate = new Date().toISOString().split('T')[0];
  const urls: SitemapUrl[] = [];

  // ── Index page now in sitemap-core.xml ─────────────────────────────────
  // /swimming-club-software/ moved to core sitemap for higher priority

  // ── County pages ──────────────────────────────────────────────────────
  for (const countySlug of Object.keys(countiesData)) {
    urls.push({
      loc: `${baseUrl}/swimming-club-software/${countySlug}/`,
      lastmod: currentDate,
      changefreq: 'weekly',
      priority: '0.7',
    });
  }

  // ── Town pages ────────────────────────────────────────────────────────
  // Build a reverse lookup: county name → county slug
  const countyNameToSlug: Record<string, string> = {};
  for (const [slug, county] of Object.entries(countiesData)) {
    countyNameToSlug[(county as { name: string }).name] = slug;
  }

  for (const [townSlug, town] of Object.entries(townsData)) {
    const countySlug = countyNameToSlug[(town as { region: string }).region];
    if (!countySlug) continue;
    urls.push({
      loc: `${baseUrl}/swimming-club-software/${countySlug}/${townSlug}/`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '0.6',
    });
  }

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
