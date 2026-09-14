import { BRAND } from '../config';
import { directoryPaths } from '../lib/clubs';
export function GET() {
  const pages = ['/', '/features/', '/pricing/', '/founding-clubs/', ...directoryPaths];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((page) => `<url><loc>${BRAND.website}${page}</loc></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
}
