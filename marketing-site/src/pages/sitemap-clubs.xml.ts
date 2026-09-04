import type { APIRoute } from 'astro';
import clubsData from '../data/clubs.json';

const baseUrl = 'https://swimly.uk';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

/** Convert a region name to a URL-safe slug */
function toSlug(value: string): string {
  return value.toLowerCase().replace(/ /g, '-');
}

export const GET: APIRoute = async () => {
  const currentDate = new Date().toISOString().split('T')[0];
  const urls: SitemapUrl[] = [];

  // ── Clubs index pages now in sitemap-core.xml ──────────────────────────
  // /clubs/, /clubs/map/ moved to core sitemap for higher priority
  // /clubs/add/ removed (user action page, not indexable content)

  // ── Region pages ──────────────────────────────────────────────────────
  const regions = [...new Set(clubsData.map((club) => club.region))];

  for (const region of regions) {
    const regionSlug = toSlug(region);
    urls.push({
      loc: `${baseUrl}/clubs/${regionSlug}/`,
      lastmod: currentDate,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  // ── Individual club pages ─────────────────────────────────────────────
  for (const club of clubsData) {
    const regionSlug = toSlug(club.region);
    urls.push({
      loc: `${baseUrl}/clubs/${regionSlug}/${club.slug}/`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '0.7',
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
