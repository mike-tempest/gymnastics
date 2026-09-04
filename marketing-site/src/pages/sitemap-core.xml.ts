import type { APIRoute } from 'astro';

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

  // ── Static pages ──────────────────────────────────────────────────────
  urls.push(
    { loc: `${baseUrl}/`, lastmod: currentDate, changefreq: 'weekly', priority: '1.0' },
    { loc: `${baseUrl}/features/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.9' },
    { loc: `${baseUrl}/pricing/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.9' },
    { loc: `${baseUrl}/blog/`, lastmod: currentDate, changefreq: 'daily', priority: '0.9' },
    { loc: `${baseUrl}/clubs/`, lastmod: currentDate, changefreq: 'weekly', priority: '0.8' },
    { loc: `${baseUrl}/clubs/map/`, lastmod: currentDate, changefreq: 'weekly', priority: '0.7' },
    { loc: `${baseUrl}/swimming-club-software/`, lastmod: currentDate, changefreq: 'weekly', priority: '0.8' },
    { loc: `${baseUrl}/about/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
    { loc: `${baseUrl}/faq/`, lastmod: currentDate, changefreq: 'weekly', priority: '0.8' },
    { loc: `${baseUrl}/swim-school-management/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/swimming-club-billing-software/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/swim-team-management-software/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/swimming-management-software/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/swim-club-software/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/swim-club-management-software/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/swimming-club-membership-software/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/swimming-club-payment-software/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/best-swim-club-software-uk/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.8' },
    { loc: `${baseUrl}/contact/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
    { loc: `${baseUrl}/founding-clubs/`, lastmod: currentDate, changefreq: 'monthly', priority: '0.7' },
    { loc: `${baseUrl}/privacy/`, lastmod: currentDate, changefreq: 'yearly', priority: '0.3' },
    { loc: `${baseUrl}/terms/`, lastmod: currentDate, changefreq: 'yearly', priority: '0.3' },
  );

  // ── Feature pages ─────────────────────────────────────────────────────
  const featurePages = ['membership', 'billing', 'attendance', 'compliance', 'competitions', 'parent-portal', 'mobile'];
  for (const page of featurePages) {
    urls.push({
      loc: `${baseUrl}/features/${page}/`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '0.8',
    });
  }

  // ── Competitor comparison pages ───────────────────────────────────────
  const competitors = ['cluborganiser', 'clubspark', 'coacha', 'gomotion', 'swimclubmanager', 'teamunify'];
  for (const competitor of competitors) {
    urls.push({
      loc: `${baseUrl}/compare/${competitor}/`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '0.8',
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
