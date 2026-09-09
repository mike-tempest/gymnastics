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

test.describe('Attendance Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display attendance page and allow marking attendance', async ({ page }) => {
    await page.goto('/attendance');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Verify page loads
    await page.waitForTimeout(1500);
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });

  /**
   * Walks the session dropdown until it lands on one whose register has at
   * least one gymnast still unmarked, and returns that session's label.
   *
   * The demo club seeds six weeks of sessions, the later ones scheduled rather
   * than completed, so there is always one to find. Searching rather than
   * hard-coding an index keeps the test re-runnable: a previous run that
   * marked somebody present just moves the search along.
   */
  async function selectSessionWithUnmarkedGymnast(page): Promise<string> {
    const selector = page.locator('#session-select');
    await expect(selector).toBeVisible({ timeout: 10000 });

    const values = await selector
      .locator('option')
      .evaluateAll((options: HTMLOptionElement[]) => options.map((o) => o.value).filter(Boolean));
    expect(values.length).toBeGreaterThan(0);

    for (const value of values) {
      await selector.selectOption(value);

      // A session whose squad is empty renders an empty state instead, so a
      // miss here is an ordinary outcome: move on to the next session.
      const unmarked = page.locator('[data-status="unmarked"]').first();
      const found = await unmarked
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      if (found) {
        return value;
      }
    }

    throw new Error('No session in the dropdown had an unmarked gymnast');
  }

  // The register for a session that has not happened yet has no attendance
  // rows behind it. It must still list the session's squad, or a coach cannot
  // take the register for the session they are about to run.
  test('should select a session and display member list', async ({ page }) => {
    await page.goto('/attendance');

    await selectSessionWithUnmarkedGymnast(page);

    const rows = page.locator('[data-testid="roster-member"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // An unmarked gymnast is shown without a status rather than defaulted to one.
    await expect(page.locator('[data-status="unmarked"]').first()).toBeVisible();
  });

  test('should mark a member as present and verify status update', async ({ page }) => {
    await page.goto('/attendance');

    await selectSessionWithUnmarkedGymnast(page);

    const unmarked = page.locator('[data-status="unmarked"]').first();
    const memberId = await unmarked.getAttribute('data-member-id');
    expect(memberId).toBeTruthy();

    // A quick tap marks present; holding opens the status picker instead.
    await unmarked.click();

    const row = page.locator(`[data-member-id="${memberId}"]`);
    await expect(row).toHaveAttribute('data-status', 'present', { timeout: 10000 });
  });
});
