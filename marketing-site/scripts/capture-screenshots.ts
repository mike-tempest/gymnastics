#!/usr/bin/env node
/**
 * Swimly Screenshot Capture Script
 *
 * Captures product screenshots from the live Swimly app for use in marketing materials.
 * Handles NextAuth authentication and captures both desktop and mobile viewports.
 */

import { chromium, type Browser, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const APP_URL = 'https://web-app-production-7a4c.up.railway.app';
const SCREENSHOTS_DIR = path.join(process.cwd(), 'public', 'screenshots');

// Demo credentials
const CREDENTIALS = {
  email: 'admin@rtwmonson.co.uk',
  password: 'Demo2024!',
};

// Pages to capture
const PAGES = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/swimmers', name: 'swimmers' },
  { path: '/sessions', name: 'sessions' },
  { path: '/billing', name: 'billing' },
  { path: '/compliance', name: 'compliance' },
  { path: '/parent', name: 'parent' },
];

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/**
 * Perform NextAuth login
 */
async function login(page: Page): Promise<void> {
  console.log('Navigating to app...');
  await page.goto(APP_URL);

  // Wait for redirect to sign-in page or check if already at dashboard
  await page.waitForLoadState('networkidle');

  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Check if we're already logged in
  if (currentUrl.includes('/dashboard')) {
    console.log('Already logged in');
    return;
  }

  // Find and navigate to sign-in page if not already there
  if (!currentUrl.includes('/signin') && !currentUrl.includes('/auth')) {
    console.log('Looking for sign-in link...');
    // Try to click sign-in button or navigate directly
    try {
      await page.click('a[href*="signin"], button:has-text("Sign in")', { timeout: 3000 });
      await page.waitForLoadState('networkidle');
    } catch {
      // Navigate directly to common NextAuth paths
      for (const authPath of ['/auth/signin', '/api/auth/signin', '/signin']) {
        try {
          await page.goto(`${APP_URL}${authPath}`);
          await page.waitForLoadState('networkidle');
          if (page.url().includes('signin') || page.url().includes('auth')) {
            break;
          }
        } catch (e) {
          console.log(`Tried ${authPath}, continuing...`);
        }
      }
    }
  }

  console.log('Filling in credentials...');

  // Fill in credentials (try multiple possible selectors)
  const emailFilled = await fillInput(page, CREDENTIALS.email, [
    'input[name="email"]',
    'input[type="email"]',
    'input[placeholder*="email" i]',
    '#email',
  ]);

  if (!emailFilled) {
    throw new Error('Could not find email input field');
  }

  const passwordFilled = await fillInput(page, CREDENTIALS.password, [
    'input[name="password"]',
    'input[type="password"]',
    '#password',
  ]);

  if (!passwordFilled) {
    throw new Error('Could not find password input field');
  }

  console.log('Submitting login form...');

  // Click the Sign In button
  const submitButton = await page.waitForSelector('button:has-text("Sign In")', { timeout: 5000 });
  await submitButton.click();

  // Wait for navigation away from login page
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), {
    timeout: 15000,
  });

  await page.waitForLoadState('networkidle');

  const finalUrl = page.url();
  console.log('Login complete, navigated to:', finalUrl);

  // Verify we're logged in by checking if we're no longer on the login page
  if (finalUrl.includes('/login') || finalUrl.includes('/signin')) {
    throw new Error('Login may have failed - still on login page');
  }

  console.log('Login successful');
}

/**
 * Try to fill an input using multiple selectors
 */
async function fillInput(page: Page, value: string, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await page.fill(selector, value);
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Capture screenshot of a page
 */
async function captureScreenshot(
  page: Page,
  pagePath: string,
  pageName: string,
  viewport: string
): Promise<string> {
  console.log(`Capturing ${viewport} screenshot: ${pageName}...`);

  const url = `${APP_URL}${pagePath}`;
  await page.goto(url, { waitUntil: 'networkidle' });

  // Additional wait to ensure dynamic content is loaded
  await page.waitForTimeout(2000);

  // Wait for any loading spinners to disappear
  try {
    await page.waitForSelector('[class*="loading"], [class*="spinner"]', {
      state: 'hidden',
      timeout: 5000,
    });
  } catch {
    // No loading indicator found or already hidden
  }

  const filename = `${pageName}-${viewport}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  await page.screenshot({
    path: filepath,
    fullPage: false, // Capture viewport only
  });

  console.log(`✓ Saved: ${filename}`);
  return filepath;
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting screenshot capture...\n');

  // Ensure screenshots directory exists
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  try {
    // Create a context with desktop viewport for initial login
    const context = await browser.newContext({
      viewport: VIEWPORTS.desktop,
    });

    const page = await context.newPage();

    // Perform login
    await login(page);

    // Capture desktop screenshots
    console.log('\n--- Capturing Desktop Screenshots (1440x900) ---\n');
    await page.setViewportSize(VIEWPORTS.desktop);

    for (const pageConfig of PAGES) {
      try {
        await captureScreenshot(page, pageConfig.path, pageConfig.name, 'desktop');
      } catch (error) {
        console.error(`✗ Failed to capture ${pageConfig.name} (desktop):`, error.message);
      }
    }

    // Capture mobile screenshots
    console.log('\n--- Capturing Mobile Screenshots (390x844) ---\n');
    await page.setViewportSize(VIEWPORTS.mobile);

    for (const pageConfig of PAGES) {
      try {
        await captureScreenshot(page, pageConfig.path, pageConfig.name, 'mobile');
      } catch (error) {
        console.error(`✗ Failed to capture ${pageConfig.name} (mobile):`, error.message);
      }
    }

    await context.close();

    console.log('\n✓ Screenshot capture complete!\n');
  } catch (error) {
    console.error('\n✗ Error during screenshot capture:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run if executed directly
// Check if this is the main module (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
