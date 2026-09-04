import type { APIRoute } from 'astro';
import { REGIONS } from '../../config/regions';

// Deploys to swimly.club/robots.txt (the international/ directory is mounted at
// the swimly.club root). The UK robots.txt at public/robots.txt is separate
// and untouched.
const baseUrl = REGIONS.us.host; // swimly.club, shared by all intl regions

export const GET: APIRoute = async () => {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /_astro/

User-agent: Googlebot
Allow: /

Sitemap: ${baseUrl}/sitemap-index.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
