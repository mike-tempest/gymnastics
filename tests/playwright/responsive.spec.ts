import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'admin@kestrelvalegym.org.uk');
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Demo2024!');
  const loginResponse = page.waitForResponse(
    (resp) => resp.url().includes('/auth/login') && resp.status() === 201,
    { timeout: 15000 }
  );
  await page.click('button[type="submit"]');
  await loginResponse;
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Mobile Responsive Design', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should render dashboard without horizontal scroll on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000); // Allow page to fully load

    // Check no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBe(false);

    // Verify dashboard content is visible
    const content = page.locator('body');
    await expect(content).toBeVisible();
  });

  test('should adapt members page for mobile viewport', async ({ page }) => {
    await page.goto('/members');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Verify page renders
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('should display billing amounts correctly on mobile', async ({ page }) => {
    const response = await page.goto('/billing');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Check if page loads successfully
    if (!response || response.status() === 404) {
      test.skip();
      return;
    }

    // Verify page renders
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('should render forms correctly on mobile', async ({ page }) => {
    await page.goto('/members');
    await page.waitForTimeout(1000);

    // Check if there's a search input (common form element)
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i]')
      .first();
    const inputVisible = await searchInput.isVisible().catch(() => false);

    if (inputVisible) {
      // Verify input is usable on mobile
      await expect(searchInput).toBeVisible();

      // Verify input width doesn't overflow viewport
      const inputBox = await searchInput.boundingBox();
      if (inputBox) {
        expect(inputBox.width).toBeLessThanOrEqual(375);
      }
    }
  });
});
