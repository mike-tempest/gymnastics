import { WEB_BASE } from './helpers';

describe('Frontend Smoke Tests', () => {
  describe('Public pages', () => {
    it('GET /login returns 200', async () => {
      const res = await fetch(`${WEB_BASE}/login`, { redirect: 'manual' });
      expect(res.status).toBe(200);
    });

    it('GET /register returns 200', async () => {
      const res = await fetch(`${WEB_BASE}/register`, { redirect: 'manual' });
      expect(res.status).toBe(200);
    });
  });

  describe('Protected pages redirect to login when unauthenticated', () => {
    const protectedRoutes = [
      '/',
      '/members',
      '/families',
      '/squads',
      '/sessions',
      '/attendance',
      '/billing',
      '/compliance',
      '/admin',
      '/communications',
      '/onboarding',
      '/parent',
    ];

    test.each(protectedRoutes)('GET %s redirects (307)', async (route) => {
      const res = await fetch(`${WEB_BASE}${route}`, { redirect: 'manual' });
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login');
    });
  });

  describe('API health check', () => {
    it('GET /api/health or root returns a response', async () => {
      const apiBase = process.env.API_BASE_URL || 'https://membership-api-production-3628.up.railway.app/api';
      // Strip /api suffix for health check
      const baseUrl = apiBase.replace(/\/api$/, '');
      const res = await fetch(`${baseUrl}/health`);
      // Accept 200 (health endpoint) or 404 (no health endpoint but server responds)
      expect([200, 404]).toContain(res.status);
    });
  });
});
