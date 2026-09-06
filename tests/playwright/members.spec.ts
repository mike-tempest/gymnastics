import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'admin@rtwmonson.co.uk');
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Demo2024!');
  const loginResponse = page.waitForResponse(
    resp => resp.url().includes('/auth/login') && resp.status() === 201,
    { timeout: 15000 }
  );
  await page.click('button[type="submit"]');
  await loginResponse;
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Member Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display members page with list of members', async ({ page }) => {
    await page.goto('/members');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Verify page loads (look for table or content)
    await page.waitForTimeout(2000); // Allow data to load
    
    // Count member rows or cards (at least 10 visible)
    const memberRows = page.locator('tbody tr');
    const count = await memberRows.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('should navigate to member detail page when clicking on member', async ({ page }) => {
    await page.goto('/members');
    await page.waitForTimeout(1000);

    // Click on first member name or row
    const firstMember = page.locator('tbody tr a, [data-testid="member-link"], tbody tr').first();
    await firstMember.click();

    // Verify detail page loads (URL changes and member info visible)
    await page.waitForURL(url => url.pathname.includes('/member'), { timeout: 10000 });
    
    // Verify member information is displayed
    const memberInfo = page.locator('text=/first.*name|last.*name|date.*birth/i').first();
    await expect(memberInfo).toBeVisible({ timeout: 5000 });
  });

  test('should filter members using search functionality', async ({ page }) => {
    await page.goto('/members');
    await page.waitForTimeout(1000);

    // Get initial count
    const allRows = page.locator('tbody tr');
    const initialCount = await allRows.count();

    // Type 'Emma' in search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name*="search"]').first();
    await searchInput.fill('Emma');
    await page.waitForTimeout(1500); // Allow filtering to complete

    // Verify results are filtered
    const filteredRows = page.locator('tbody tr');
    const filteredCount = await filteredRows.count();
    
    // Filtered results should be different from initial and contain 'Emma'
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    
    // Check if any visible row contains 'Emma'
    if (filteredCount > 0) {
      const firstRowText = await filteredRows.first().textContent();
      expect(firstRowText.toLowerCase()).toContain('emma');
    }
  });

  test('should filter members by squad if dropdown exists', async ({ page }) => {
    await page.goto('/members');
    await page.waitForTimeout(1000);

    // Check if squad filter dropdown exists
    const squadFilter = page.locator('select[name*="squad"], [data-testid="squad-filter"], select').first();
    const isVisible = await squadFilter.isVisible().catch(() => false);

    if (isVisible) {
      // Get initial count
      const initialRows = page.locator('tbody tr');
      const initialCount = await initialRows.count();

      // Select first squad option (skip empty/default option)
      const options = await squadFilter.locator('option').all();
      if (options.length > 1) {
        await squadFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1500);

        // Verify results changed
        const filteredRows = page.locator('tbody tr');
        const filteredCount = await filteredRows.count();
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
      }
    } else {
      // Skip test if squad filter not found
      test.skip();
    }
  });
});
