import { test, expect } from '@playwright/test';

const EMAIL = process.env.ADMIN_EMAIL || 'admin@rtwmonson.co.uk';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Demo2024!';

async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  const loginResponse = page.waitForResponse(
    (resp: any) => resp.url().includes('/auth/login') && resp.status() === 201,
    { timeout: 15000 }
  );
  await page.click('button[type="submit"]');
  await loginResponse;
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads with stats', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Total Swimmers')).toBeVisible({ timeout: 10000 });
  });

  test('swimmers page loads', async ({ page }) => {
    await page.goto('/swimmers');
    await expect(page.locator('text=Total Swimmers')).toBeVisible({ timeout: 10000 });
  });

  test('families page loads', async ({ page }) => {
    await page.goto('/families');
    await expect(page.locator('text=Total Families')).toBeVisible({ timeout: 10000 });
  });

  test('squads page loads', async ({ page }) => {
    await page.goto('/squads');
    await expect(page.locator('text=Total Squads')).toBeVisible({ timeout: 10000 });
  });

  test('sessions page loads', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.locator('text=Total Sessions')).toBeVisible({ timeout: 10000 });
  });

  test('billing page loads', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.locator('text=All Invoices')).toBeVisible({ timeout: 10000 });
  });

  test('communications page loads', async ({ page }) => {
    await page.goto('/communications');
    await expect(page.locator('text=Messages Sent')).toBeVisible({ timeout: 10000 });
  });

  test('admin dashboard loads', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('text=Admin Dashboard')).toBeVisible({ timeout: 10000 });
  });
});
