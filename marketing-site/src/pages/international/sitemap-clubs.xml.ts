import type { APIRoute } from 'astro';
import { REGIONS } from '../../config/regions';

// Deploys to swimly.club/sitemap-clubs.xml (the international/ directory is
// mounted at the swimly.club root). Emits the club-directory URLs for every
// international region: the /clubs/ hub, one page per state or province with
// listed clubs, and one page per club.
//
// Club data files are discovered with import.meta.glob so a missing file
// yields no URLs rather than a build failure (same pattern as
// sitemap-core.xml.ts).

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

interface ClubEntry {
  slug: string;
  stateSlug?: string;
  provinceSlug?: string;
}

const clubModules = import.meta.glob<{ default: ClubEntry[] }>(
  '../../data/{us-clubs,ca-clubs,au-clubs}.json',
  { eager: true }
);

const CLUB_FILE: Record<string, string> = {
  us: 'us-clubs.json',
  ca: 'ca-clubs.json',
  au: 'au-clubs.json',
};

function clubsFor(regionKey: string): ClubEntry[] {
  const fileName = CLUB_FILE[regionKey];
  const moduleKey = Object.keys(clubModules).find((key) => key.endsWith(`/${fileName}`));
  if (!moduleKey) return [];
  const parsed = clubModules[moduleKey]?.default;
  return Array.isArray(parsed) ? parsed : [];
}

function locationSlug(club: ClubEntry): string | null {
  return club.stateSlug ?? club.provinceSlug ?? null;
}

export const GET: APIRoute = async () => {
  const currentDate = new Date().toISOString().split('T')[0];
  const urls: SitemapUrl[] = [];

  for (const regionKey of Object.keys(CLUB_FILE)) {
    const region = REGIONS[regionKey as keyof typeof REGIONS];
    const base = `${region.host}${region.pathPrefix}`;
    const clubs = clubsFor(regionKey);
    if (clubs.length === 0) continue;

    urls.push({
      loc: `${base}/clubs/`,
      lastmod: currentDate,
      changefreq: 'weekly',
      priority: '0.8',
    });
    urls.push({
      loc: `${base}/clubs/map/`,
      lastmod: currentDate,
      changefreq: 'weekly',
      priority: '0.6',
    });

    const locations = [
      ...new Set(clubs.map(locationSlug).filter((slug): slug is string => Boolean(slug))),
    ];
    for (const slug of locations) {
      urls.push({
        loc: `${base}/clubs/${slug}/`,
        lastmod: currentDate,
        changefreq: 'weekly',
        priority: '0.7',
      });
    }

    for (const club of clubs) {
      const location = locationSlug(club);
      if (!location) continue;
      urls.push({
        loc: `${base}/clubs/${location}/${club.slug}/`,
        lastmod: currentDate,
        changefreq: 'monthly',
        priority: '0.6',
      });
    }
  }

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
