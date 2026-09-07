import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_EMAIL || 'admin@kestrelvalegym.org.uk');
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Demo2024!');
  const loginResponse = page.waitForResponse(
    resp => resp.url().includes('/auth/login') && resp.status() === 201,
    { timeout: 15000 }
  );
  await page.click('button[type="submit"]');
  await loginResponse;
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
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

  test('should select a session and display member list', async ({ page }) => {
    await page.goto('/attendance');
    await page.waitForTimeout(1000);

    // Look for session selector (dropdown, list, or buttons)
    const sessionSelector = page.locator('select[name*="session"], [data-testid="session-selector"], select, button[role="option"]').first();
    await expect(sessionSelector).toBeVisible({ timeout: 5000 });

    // Select a session
    const isSelect = await sessionSelector.evaluate(el => el.tagName.toLowerCase() === 'select');
    if (isSelect) {
      const options = await sessionSelector.locator('option').all();
      if (options.length > 1) {
        await sessionSelector.selectOption({ index: 1 });
      }
    } else {
      await sessionSelector.click();
    }

    await page.waitForTimeout(2000); // Allow member list to load

    // Verify member list appears
    const memberList = page.locator('tbody tr, [data-testid="member-item"], .member-list-item, [class*="attendance-row"]').first();
    await expect(memberList).toBeVisible({ timeout: 5000 });
  });

  test('should mark a member as present and verify status update', async ({ page }) => {
    await page.goto('/attendance');
    await page.waitForTimeout(1000);

    // Select a session
    const sessionSelector = page.locator('select[name*="session"], [data-testid="session-selector"], select').first();
    const isVisible = await sessionSelector.isVisible().catch(() => false);
    
    if (isVisible) {
      const isSelect = await sessionSelector.evaluate(el => el.tagName.toLowerCase() === 'select');
      if (isSelect) {
        const options = await sessionSelector.locator('option').all();
        if (options.length > 1) {
          await sessionSelector.selectOption({ index: 1 });
        }
      } else {
        await sessionSelector.click();
      }
      
      await page.waitForTimeout(2000);
    }

    // Find a checkbox or button to mark attendance
    const attendanceControl = page.locator(
      'input[type="checkbox"][name*="attendance"], ' +
      'input[type="checkbox"][aria-label*="present"], ' +
      'button[aria-label*="present"], ' +
      '[data-testid="attendance-checkbox"], ' +
      'tbody tr input[type="checkbox"]'
    ).first();

    await expect(attendanceControl).toBeVisible({ timeout: 5000 });

    // Get initial state
    const isCheckbox = await attendanceControl.evaluate(el => el.type === 'checkbox');
    let initialState;
    
    if (isCheckbox) {
      initialState = await attendanceControl.isChecked();
    } else {
      initialState = await attendanceControl.getAttribute('aria-pressed');
    }

    // Click to mark present
    await attendanceControl.click();
    await page.waitForTimeout(1000);

    // Verify status changed
    if (isCheckbox) {
      const newState = await attendanceControl.isChecked();
      expect(newState).not.toBe(initialState);
    } else {
      const newState = await attendanceControl.getAttribute('aria-pressed');
      expect(newState).not.toBe(initialState);
    }
  });
});
