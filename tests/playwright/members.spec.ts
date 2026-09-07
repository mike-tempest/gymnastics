import { test, expect, Page } from '@playwright/test';

// Defaults are the demo gymnastics club (docs/demos/gym-demo-club.md), which
// seeds 16 gymnasts across eight squads.
const EMAIL = process.env.TEST_EMAIL || 'admin@kestrelvalegym.org.uk';
const PASSWORD = process.env.TEST_PASSWORD || 'Demo2024!';

/**
 * The members page renders each gymnast as a card linking to their detail
 * page, not as a table row. Filtering on the card's name heading keeps the
 * "Import CSV" link, which is also under /members/, out of the list.
 */
function memberCards(page: Page) {
  return page.locator('a[href^="/members/"]').filter({ has: page.locator('h3') });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  const loginResponse = page.waitForResponse(
    (resp) => resp.url().includes('/auth/login') && resp.status() === 201,
    { timeout: 15000 }
  );
  await page.click('button[type="submit"]');
  await loginResponse;
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Member Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display members page with list of members', async ({ page }) => {
    await page.goto('/members');
    await expect(memberCards(page).first()).toBeVisible({ timeout: 10000 });

    const count = await memberCards(page).count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('should navigate to member detail page when clicking on member', async ({ page }) => {
    await page.goto('/members');
    const firstMember = memberCards(page).first();
    await expect(firstMember).toBeVisible({ timeout: 10000 });

    const name = ((await firstMember.locator('h3').textContent()) ?? '').trim();
    expect(name.length).toBeGreaterThan(0);
    await firstMember.click();

    // Detail pages live at /members/<member_id>.
    await page.waitForURL(/\/members\/[^/]+$/, { timeout: 10000 });
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  });

  test('should filter members using search functionality', async ({ page }) => {
    await page.goto('/members');
    await expect(memberCards(page).first()).toBeVisible({ timeout: 10000 });
    const initialCount = await memberCards(page).count();
    expect(initialCount).toBeGreaterThan(1);

    // The page search, not the global one in the header, which also has a
    // placeholder starting "Search".
    // The demo club seeds exactly one gymnast called Emma.
    await page.fill('input[placeholder*="registration number" i]', 'Emma');
    await expect(memberCards(page)).toHaveCount(1, { timeout: 10000 });

    const firstRowText = (await memberCards(page).first().textContent()) ?? '';
    expect(firstRowText.toLowerCase()).toContain('emma');
  });

  test('should filter members by squad', async ({ page }) => {
    await page.goto('/members');
    await expect(memberCards(page).first()).toBeVisible({ timeout: 10000 });
    const initialCount = await memberCards(page).count();

    // The first select on the page is the squad filter.
    const squadFilter = page.locator('select').first();
    const options = await squadFilter.locator('option').all();
    expect(options.length).toBeGreaterThan(1);

    await squadFilter.selectOption({ index: 1 });
    await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible({ timeout: 10000 });

    const filteredCount = await memberCards(page).count();
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });
});
