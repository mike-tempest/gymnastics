import { test, expect } from '@playwright/test';

const EMAIL = process.env.ADMIN_EMAIL || 'admin@rtwmonson.co.uk';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Demo2024!';

test.describe('Login Flow', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Swimly' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);

    // Listen for API call to confirm login happened
    const loginResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/login') && resp.status() === 201,
      { timeout: 15000 }
    );

    await page.click('button[type="submit"]');
    await loginResponse;

    // Wait for client-side redirect (router.push('/'))
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  });

  test('login with wrong password stays on login page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', 'WrongPassword!');
    await page.click('button[type="submit"]');

    // Should stay on login page (either error message or just stays)
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/login');
  });

  test('demo credentials displayed on login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=admin@rtwmonson.co.uk')).toBeVisible();
    await expect(page.locator('text=Demo2024!')).toBeVisible();
  });
});
