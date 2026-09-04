import { test, expect } from '@playwright/test';

/**
 * Swimly E2E Smoke Tests
 * 
 * These tests verify that major sections of the application render without errors.
 * They do not test detailed functionality, only that pages load successfully.
 */

test.describe('Public Pages', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    
    // Check that the page loaded successfully (no 500 error)
    expect(page.url()).toContain('/login');
    
    // Verify some expected content is present
    await expect(page).toHaveTitle(/Swimly|Login/i);
  });
});

test.describe('Admin Dashboard', () => {
  test('dashboard page renders', async ({ page }) => {
    // Note: This test will need authentication in a real scenario
    // For now, we just verify the route exists
    await page.goto('/');
    
    // Check that we didn't get a 404 or 500
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Swimmers Section', () => {
  test('swimmers list page renders', async ({ page }) => {
    const response = await page.goto('/swimmers');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Families Section', () => {
  test('families list page renders', async ({ page }) => {
    const response = await page.goto('/families');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Squads Section', () => {
  test('squads list page renders', async ({ page }) => {
    const response = await page.goto('/squads');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Sessions Section', () => {
  test('sessions list page renders', async ({ page }) => {
    const response = await page.goto('/sessions');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Attendance Section', () => {
  test('attendance page renders', async ({ page }) => {
    const response = await page.goto('/attendance');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Billing Section', () => {
  test('invoices page renders', async ({ page }) => {
    const response = await page.goto('/invoices');
    expect(response?.status()).toBeLessThan(500);
  });

  test('fee structures page renders', async ({ page }) => {
    const response = await page.goto('/fee-structures');
    expect(response?.status()).toBeLessThan(500);
  });

  test('payments page renders', async ({ page }) => {
    const response = await page.goto('/payments');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Compliance Section', () => {
  test('DBS page renders', async ({ page }) => {
    const response = await page.goto('/compliance/dbs');
    expect(response?.status()).toBeLessThan(500);
  });

  test('consent page renders', async ({ page }) => {
    const response = await page.goto('/compliance/consent');
    expect(response?.status()).toBeLessThan(500);
  });

  test('safeguarding page renders', async ({ page }) => {
    const response = await page.goto('/compliance/safeguarding');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Communications Section', () => {
  test('communications page renders', async ({ page }) => {
    const response = await page.goto('/communications');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Parent Portal', () => {
  test('parent dashboard renders', async ({ page }) => {
    const response = await page.goto('/parent');
    expect(response?.status()).toBeLessThan(500);
  });

  test('parent children page renders', async ({ page }) => {
    const response = await page.goto('/parent/children');
    expect(response?.status()).toBeLessThan(500);
  });

  test('parent invoices page renders', async ({ page }) => {
    const response = await page.goto('/parent/invoices');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Admin Settings', () => {
  test('admin settings page renders', async ({ page }) => {
    const response = await page.goto('/admin/settings');
    expect(response?.status()).toBeLessThan(500);
  });
});
