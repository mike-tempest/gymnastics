#!/usr/bin/env node
/**
 * Regional product screenshot capture for the swimly.club pages.
 *
 * The /us, /ca and /au pages sell to clubs that bill in USD, CAD and AUD, so
 * reusing the swimly.uk screenshots (GBP, dd/mm/yyyy, Swim England numbers) on
 * them reads as a UK product with a translated wrapper. This script captures
 * the same app once per region instead.
 *
 * Nothing is faked at the browser layer. scripts/screenshot-fixture.mjs makes
 * the scratch demo club genuinely a club in the target region, and the app then
 * renders its own currency, dates and governing body from that. See
 * docs/regional-screenshots.md for the full pipeline.
 *
 * Requires a local stack (membership service on :3001 against the scratch
 * database, web app on :3000):
 *
 *   node --import tsx scripts/capture-regional-screenshots.mts
 *
 * Override with APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD, PARENT_EMAIL.
 */

import { chromium, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rtwmonson.co.uk';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Demo2024!';
const PARENT_EMAIL = process.env.PARENT_EMAIL || 'sarah.johnson@gmail.com';
const PARENT_PASSWORD = process.env.PARENT_PASSWORD || ADMIN_PASSWORD;

const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'app-screenshots');

interface Region {
  /** Directory the screenshots land in, matching the site's URL prefix. */
  slug: string;
  locale: string;
  timezone: string;
}

const REGIONS: Region[] = [
  { slug: 'us', locale: 'en-US', timezone: 'America/New_York' },
  { slug: 'ca', locale: 'en-CA', timezone: 'America/Toronto' },
  { slug: 'au', locale: 'en-AU', timezone: 'Australia/Brisbane' },
];

/**
 * Pages that carry the same meaning in every region, and the role that should
 * be signed in to reach them.
 *
 * Three pages are deliberately absent:
 *  - Compliance is built around DBS checks, which exist only in the UK, so it
 *    would misrepresent the product on the international pages.
 *  - The admin dashboard renders two empty cards for every club: GET
 *    /finance/dashboard 500s because FinanceController declares no guards, so
 *    no tenant context is established, and the attendance rate is computed from
 *    *upcoming* sessions, which cannot have attendance yet.
 *  - The parent dashboard asks Swimmer for a "squad" relation the entity does
 *    not define. /parent/invoices takes a different path and does render.
 *
 * Fix those and the dashboard becomes the strongest screenshot of the set;
 * until then it undersells the product.
 *
 * Attendance is also absent: the register defaults to the next session, and no
 * swimmers are assigned to sessions in the demo data, so it renders an empty
 * state. Seeding session participants would make it usable.
 */
const PAGES = [
  { path: '/swimmers', name: 'swimmers', role: 'admin' as const },
  { path: '/sessions', name: 'sessions', role: 'admin' as const },
  { path: '/billing', name: 'billing', role: 'admin' as const },
  { path: '/parent/invoices', name: 'parent-invoices', role: 'parent' as const },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** Rewrite the scratch database so the demo club belongs to this region. */
function applyFixture(region: Region): void {
  execFileSync('node', [path.join('scripts', 'screenshot-fixture.mjs'), region.slug], {
    stdio: 'inherit',
  });
}

/**
 * The API throttles to 60 requests per minute per IP, and a full capture makes
 * more than that: loading these pages fires several calls each. Sign-in is
 * where the limit surfaces, so retry it across the throttle window rather than
 * failing the run two regions in.
 */
async function login(page: Page, email: string, password: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' });

    // The sign-in handler only exists once React has hydrated. Clicking before
    // then submits the form natively and puts the password in the query string
    // instead of signing in.
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);

    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"], button:has-text("Sign In")');

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
      return;
    } catch (error) {
      if (attempt >= 4) throw error;
      console.log(`  sign-in attempt ${attempt} failed, waiting out the rate limit`);
      await page.waitForTimeout(65000);
    }
  }
}

async function capture(
  page: Page,
  pagePath: string,
  name: string,
  viewport: string,
  region: Region,
): Promise<void> {
  await page.goto(`${APP_URL}${pagePath}`, { waitUntil: 'domcontentloaded' });

  // React Query resolves after hydration, so the first paint still shows
  // skeletons. Wait for the network to settle, then give the charts a moment.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);

  const dir = path.join(OUT_DIR, region.slug);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${name}-${viewport}.png`;
  await page.screenshot({ path: path.join(dir, filename), fullPage: false });
  console.log(`  ${region.slug}/${filename}`);
}

/** Capture every page for one role, in a context pinned to the region. */
async function captureRole(
  browser: Browser,
  region: Region,
  role: 'admin' | 'parent',
): Promise<void> {
  const pages = PAGES.filter((p) => p.role === role);
  if (pages.length === 0) return;

  // A context per region so the browser's own locale and timezone match the
  // club's, rather than inheriting the machine running the capture.
  const context = await browser.newContext({
    viewport: VIEWPORTS.desktop,
    locale: region.locale,
    timezoneId: region.timezone,
  });

  const page = await context.newPage();

  if (role === 'admin') {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  } else {
    await login(page, PARENT_EMAIL, PARENT_PASSWORD);
  }

  for (const [viewport, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size);
    for (const pageConfig of pages) {
      try {
        await capture(page, pageConfig.path, pageConfig.name, viewport, region);
      } catch (error) {
        console.error(`  failed ${region.slug}/${pageConfig.name}-${viewport}:`, error);
      }
    }
  }

  await context.close();
}

async function main(): Promise<void> {
  for (const region of REGIONS) {
    console.log(`\n--- ${region.slug.toUpperCase()} ---`);
    applyFixture(region);

    // Native date inputs ("dd/mm/yyyy" in the billing filters) render in the
    // browser's own UI language, which newContext({ locale }) does not change.
    // That needs the --lang switch, so each region gets its own browser.
    const browser = await chromium.launch({
      headless: true,
      args: [`--lang=${region.locale}`],
    });

    try {
      await captureRole(browser, region, 'admin');
      await captureRole(browser, region, 'parent');
    } finally {
      await browser.close();
    }
  }

  console.log('\nDone.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
