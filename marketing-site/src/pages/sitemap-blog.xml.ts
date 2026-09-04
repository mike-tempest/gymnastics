import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

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
  const blogPosts = await getCollection('blog');

  // ── Blog index ────────────────────────────────────────────────────────
  urls.push({
    loc: `${baseUrl}/blog/`,
    lastmod: currentDate,
    changefreq: 'weekly',
    priority: '0.8',
  });

  // ── Individual blog posts ─────────────────────────────────────────────
  for (const post of blogPosts) {
    const pubDate = post.data.pubDate
      ? new Date(post.data.pubDate).toISOString().split('T')[0]
      : currentDate;
    urls.push({
      loc: `${baseUrl}/blog/${post.id}/`,
      lastmod: pubDate,
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
