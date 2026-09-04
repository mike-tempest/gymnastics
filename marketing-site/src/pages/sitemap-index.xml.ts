import type { APIRoute } from 'astro';

const baseUrl = 'https://swimly.uk';

export const GET: APIRoute = async () => {
  const currentDate = new Date().toISOString().split('T')[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap-core.xml</loc><lastmod>${currentDate}</lastmod></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-blog.xml</loc><lastmod>${currentDate}</lastmod></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-clubs.xml</loc><lastmod>${currentDate}</lastmod></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-towns.xml</loc><lastmod>${currentDate}</lastmod></sitemap>
</sitemapindex>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
