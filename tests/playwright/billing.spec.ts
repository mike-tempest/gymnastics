import { test, expect } from '@playwright/test';

const EMAIL = process.env.ADMIN_EMAIL || 'admin@kestrelvalegym.org.uk';
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

test.describe('Billing regression tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('billing page displays amounts correctly (no toFixed crash)', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.locator('text=All Invoices')).toBeVisible({ timeout: 10000 });
    // Verify no JS errors by checking amounts render
    await expect(page.locator('text=is not a function')).not.toBeVisible();
    await expect(page.getByText('£').first()).toBeVisible();
  });

  test('payments page loads without crash (regression)', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=is not a function')).not.toBeVisible();
  });
});
