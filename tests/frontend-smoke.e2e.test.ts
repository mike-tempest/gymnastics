/**
 * Frontend smoke tests for Swimly web application
 * 
 * These tests verify that public routes are accessible and protected routes
 * correctly redirect unauthenticated users.
 * 
 * Usage:
 *   npm run test:e2e                    # Test against staging (Railway)
 *   WEB_BASE_URL=http://localhost:3000 npm run test:e2e  # Test against local
 */

import * as dotenv from 'dotenv';
import { join } from 'path';

// Load test environment variables
dotenv.config({ path: join(__dirname, '../.env.test') });

const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';

/**
 * Helper function to make web requests
 */
async function webRequest(path: string): Promise<Response> {
  const url = `${WEB_BASE_URL}${path}`;
  return fetch(url, {
    redirect: 'manual', // Don't follow redirects automatically
  });
}

describe('Swimly Frontend Smoke Tests', () => {
  describe('Public Routes', () => {
    it('should return 200 for login page', async () => {
      const response = await webRequest('/login');
      expect(response.status).toBe(200);
    });

    it('should return 200 for register page', async () => {
      const response = await webRequest('/register');
      expect(response.status).toBe(200);
    });
  });

  describe('Protected Routes (Unauthenticated)', () => {
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
    ];

    protectedRoutes.forEach((route) => {
      it(`should redirect ${route} to login (307)`, async () => {
        const response = await webRequest(route);
        
        // Next.js returns 307 for temporary redirects
        expect(response.status).toBe(307);
        
        // Verify redirect location includes login
        const location = response.headers.get('location');
        expect(location).toBeTruthy();
        expect(location).toMatch(/login/i);
      });
    });
  });

  describe('Static Assets', () => {
    it('should return 200 for favicon', async () => {
      const response = await fetch(`${WEB_BASE_URL}/favicon.ico`, {
        redirect: 'manual',
      });
      
      // Favicon might be 200 (exists) or 404 (not found), but should not redirect
      expect([200, 404]).toContain(response.status);
    });
  });
});
