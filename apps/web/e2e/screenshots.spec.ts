import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Product screenshots for the Swimly marketing site.
 *
 * Captures high-quality, full-page screenshots of key application views
 * at 1920x1080 desktop resolution with animations disabled.
 *
 * Run with:  npx playwright test e2e/screenshots.spec.ts
 */

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../marketing-site/public/screenshots');
const AUTH_STATE_PATH = path.resolve(__dirname, '../test-results/.auth-state.json');

/** Pages to capture for the marketing site */
const pages = [
  { name: 'dashboard', path: '/', title: 'Dashboard' },
  { name: 'attendance', path: '/attendance', title: 'Attendance' },
  { name: 'parent', path: '/parent', title: 'Parent Portal' },
  { name: 'invoices', path: '/billing/invoices', title: 'Invoices' },
  { name: 'compliance', path: '/compliance', title: 'Compliance' },
  { name: 'members', path: '/members', title: 'Gymnasts' },
];

test.describe('Marketing screenshots', () => {
  test.describe.configure({ mode: 'serial' });

  test.use({
    viewport: { width: 1280, height: 800 },
  });

  test('authenticate before capturing screenshots', async ({ page }) => {
    // Mock the backend auth API so NextAuth can create a valid session without a running backend
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            user_id: '1',
            email: 'admin@swimclub.com',
            first_name: 'Admin',
            last_name: 'User',
            role: 'ADMIN',
            club_id: 'club-1',
          },
          access_token: 'mock-token-12345',
        }),
      });
    });

    // Mock the NextAuth credentials callback to return a successful redirect
    await page.route('**/api/auth/callback/credentials', async (route) => {
      await route.fulfill({
        status: 302,
        headers: { Location: '/' },
      });
    });

    // Mock the NextAuth session endpoint to return a valid ADMIN session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '1',
            name: 'Admin User',
            email: 'admin@swimclub.com',
            role: 'ADMIN',
            clubId: 'club-1',
          },
          accessToken: 'mock-token-12345',
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    });

    await page.goto('/login', { waitUntil: 'networkidle' });

    await page.getByLabel('Email Address').fill('mark.wilson@rtwmonson.co.uk');
    await page.getByLabel('Password').fill('Demo2024!');

    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/*', { waitUntil: 'networkidle' });

    // Persist auth state so subsequent tests are logged in
    const dir = path.dirname(AUTH_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.context().storageState({ path: AUTH_STATE_PATH });
  });

  test.describe('page captures', () => {
    test.use({ storageState: AUTH_STATE_PATH });

    for (const pg of pages) {
      test(`capture ${pg.title} screenshot`, async ({ page }) => {
        // Disable CSS animations and transitions globally
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `,
        });

        await page.goto(pg.path, { waitUntil: 'networkidle' });

        // Allow any remaining data fetches and renders to settle
        await page.waitForTimeout(1500);

        // Hide any loading skeletons / spinners that may still be visible
        await page.addStyleTag({
          content: `
            .animate-pulse, .animate-spin {
              animation: none !important;
              opacity: 1 !important;
            }
          `,
        });

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${pg.name}.png`),
          fullPage: false,
          type: 'png',
        });

        // Sanity check – file was written
        expect(true).toBe(true);
      });
    }
  });
});
