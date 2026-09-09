import { test, expect, Page } from '@playwright/test';

import { BRAND } from '../src/lib/brand';

/**
 * Swimly Critical User Flows - E2E Smoke Tests
 *
 * These tests verify that critical pages of the application render correctly
 * without JavaScript errors. They do not test real authentication flows,
 * as there is no live backend in this environment.
 *
 * Protected routes are expected to redirect to /login when unauthenticated.
 * A redirect is treated as a successful render, provided no JS errors occur.
 */

// ---------------------------------------------------------------------------
// Helper: collect JS console errors during a test, filtering out expected
// network errors that occur when no backend is running.
// ---------------------------------------------------------------------------

type ErrorCollector = { errors: string[] };

function attachErrorCollector(page: Page): ErrorCollector {
  const collector: ErrorCollector = { errors: [] };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      collector.errors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    collector.errors.push(err.message);
  });

  return collector;
}

/**
 * Returns only the errors that indicate a genuine application crash.
 * Network errors caused by the absence of a running backend are ignored.
 */
function getCriticalErrors(collector: ErrorCollector): string[] {
  return collector.errors.filter(
    (e) =>
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('ECONNREFUSED') &&
      !e.includes('net::ERR') &&
      !e.includes('401') &&
      !e.includes('403') &&
      !e.includes('NEXT_REDIRECT')
  );
}

// ---------------------------------------------------------------------------
// 1. Admin Login Page
// ---------------------------------------------------------------------------

test.describe('Admin Login Page', () => {
  test('renders the login form', async ({ page }) => {
    const errors = attachErrorCollector(page);

    await page.goto('/login');

    // The login page should always be publicly accessible.
    expect(page.url()).toContain('/login');

    // Verify the Swimly branding is visible.
    await expect(page.getByText(BRAND.name).first()).toBeVisible();

    // Verify the email and password fields are present.
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Verify the submit button is present.
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    const critical = getCriticalErrors(errors);
    expect(critical, `Unexpected JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Admin Dashboard
// ---------------------------------------------------------------------------

test.describe('Admin Dashboard', () => {
  test('loads or redirects to login', async ({ page }) => {
    const errors = attachErrorCollector(page);

    await page.goto('/');

    // The page either renders the dashboard or redirects to the login screen.
    // Both outcomes are acceptable in a smoke test without a live backend.
    const isOnLogin = page.url().includes('/login');
    const isOnDashboard = page.url() === 'http://localhost:3000/';

    if (isOnDashboard) {
      // If we reached the dashboard, verify the heading is visible.
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    } else {
      // A redirect to login is a valid unauthenticated response.
      expect(isOnLogin).toBe(true);
      await expect(page.getByText(BRAND.name).first()).toBeVisible();
    }

    const critical = getCriticalErrors(errors);
    expect(critical, `Unexpected JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Members List
// ---------------------------------------------------------------------------

test.describe('Members', () => {
  test('members list page loads', async ({ page }) => {
    const errors = attachErrorCollector(page);

    await page.goto('/members');

    // Accept either the members page or a login redirect.
    const redirectedToLogin = page.url().includes('/login');

    if (!redirectedToLogin) {
      // Verify the page has loaded with some meaningful content.
      // The members page uses a heading or contains the word "Gymnasts".
      const hasContent = await page
        .getByText(/gymnasts/i)
        .first()
        .isVisible()
        .catch(() => false);
      expect(hasContent).toBe(true);
    } else {
      // Redirect to login is fine when unauthenticated.
      await expect(page.getByText(BRAND.name).first()).toBeVisible();
    }

    const critical = getCriticalErrors(errors);
    expect(critical, `Unexpected JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Sessions
// ---------------------------------------------------------------------------

test.describe('Sessions', () => {
  test('sessions page loads', async ({ page }) => {
    const errors = attachErrorCollector(page);

    const response = await page.goto('/sessions');

    // Verify the server returned a non-error HTTP status.
    expect(response?.status()).toBeLessThan(500);

    // Verify the page rendered something (login or sessions content).
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    const critical = getCriticalErrors(errors);
    expect(critical, `Unexpected JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Parent Portal Dashboard
// ---------------------------------------------------------------------------

test.describe('Parent Portal', () => {
  test('parent dashboard loads', async ({ page }) => {
    const errors = attachErrorCollector(page);

    const response = await page.goto('/parent');

    // Verify a non-server-error response.
    expect(response?.status()).toBeLessThan(500);

    // The page should render content (login redirect or parent portal UI).
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    const critical = getCriticalErrors(errors);
    expect(critical, `Unexpected JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Attendance
// ---------------------------------------------------------------------------

test.describe('Attendance', () => {
  test('attendance page loads', async ({ page }) => {
    const errors = attachErrorCollector(page);

    const response = await page.goto('/attendance');

    // Verify a non-server-error response.
    expect(response?.status()).toBeLessThan(500);

    // Accept login redirect or attendance page content.
    const redirectedToLogin = page.url().includes('/login');

    if (!redirectedToLogin) {
      // Attendance page should render something meaningful.
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    } else {
      await expect(page.getByText(BRAND.name).first()).toBeVisible();
    }

    const critical = getCriticalErrors(errors);
    expect(critical, `Unexpected JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });
});
