import type { APIRoute } from 'astro';
import { REGIONS } from '../../config/regions';

// Deploys to swimly.club/sitemap-index.xml (the international/ directory is
// mounted at the swimly.club root). Lists the swimly.club child sitemaps.
const baseUrl = REGIONS.us.host; // swimly.club, shared by all intl regions

export const GET: APIRoute = async () => {
  const currentDate = new Date().toISOString().split('T')[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap-core.xml</loc><lastmod>${currentDate}</lastmod></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-clubs.xml</loc><lastmod>${currentDate}</lastmod></sitemap>
</sitemapindex>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
