import { test, expect } from '@playwright/test';

const PARENT_EMAIL = 'claire.ashworth@example.com';
const PARENT_PASSWORD = 'Demo2024!';

async function loginAsParent(page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', PARENT_EMAIL);
  await page.fill('input[type="password"]', PARENT_PASSWORD);
  const loginResponse = page.waitForResponse(
    (resp) => resp.url().includes('/auth/login') && resp.status() === 201,
    { timeout: 15000 }
  );
  await page.click('button[type="submit"]');
  await loginResponse;
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Parent Role Access Control', () => {
  test('should redirect parent to /parent dashboard after login', async ({ page }) => {
    await loginAsParent(page);

    // Verify redirected to /parent (not /)
    await page.waitForTimeout(2000); // Allow redirect to complete
    const currentUrl = page.url();
    expect(currentUrl).toContain('/parent');
  });

  test('should display parent dashboard content', async ({ page }) => {
    await loginAsParent(page);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Verify parent dashboard loads (URL contains /parent)
    const currentUrl = page.url();
    expect(currentUrl).toContain('/parent');
  });

  test('should deny access to /admin page', async ({ page }) => {
    await loginAsParent(page);

    // Try to navigate to /admin
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    // Should either redirect away from /admin or show forbidden message
    const redirectedAway = !currentUrl.includes('/admin');
    const forbiddenVisible = await page
      .locator('text=/forbidden|access denied|not authorized|unauthori[sz]ed/i')
      .isVisible()
      .catch(() => false);

    expect(redirectedAway || forbiddenVisible).toBe(true);
  });

  test('should deny access to /members page', async ({ page }) => {
    await loginAsParent(page);

    // Try to navigate to /members
    await page.goto('/members');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    // Should either redirect away from /members or show forbidden message
    const redirectedAway = !currentUrl.includes('/members');
    const forbiddenVisible = await page
      .locator('text=/forbidden|access denied|not authorized|unauthori[sz]ed/i')
      .isVisible()
      .catch(() => false);

    expect(redirectedAway || forbiddenVisible).toBe(true);
  });
});
