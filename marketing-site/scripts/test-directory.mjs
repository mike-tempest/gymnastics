// Run against the production container: node marketing-site/scripts/test-directory.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const base = process.env.DIRECTORY_TEST_URL || 'http://127.0.0.1:4180';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/clubs/`);
  await page.waitForSelector('#club-filters:visible');
  assert.equal(await page.locator('[data-club]:visible').count(), 100);
  await page.getByLabel('Club, town or postcode').fill('bristol');
  assert.equal(await page.locator('[data-club]:visible').count(), 2);
  await page.getByLabel('Area', { exact: true }).selectOption('Wales');
  assert.equal(await page.locator('[data-club]:visible').count(), 0);
  assert.equal(await page.locator('#club-empty').isVisible(), true);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.waitForFunction(
    () => document.querySelector('#club-count').textContent === 'Showing 100 clubs'
  );
  await page.getByLabel('Area', { exact: true }).selectOption('Scotland');
  await page.getByLabel('Discipline or programme').selectOption('Trampoline');
  const filtered = await page
    .locator('[data-club]:visible')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        region: element.dataset.region,
        disciplines: JSON.parse(element.dataset.disciplines),
      }))
    );
  assert.ok(filtered.length > 0 && filtered.length < 69);
  assert.ok(
    filtered.every((club) => club.region === 'Scotland' && club.disciplines.includes('Trampoline'))
  );
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Club, town or postcode').fill('  bS5   6dH  ');
  assert.equal(await page.locator('[data-club]:visible').count(), 1);
  await page.getByRole('link', { name: 'View Bristol Hawks Gymnastics Club', exact: true }).click();
  assert.match(await page.locator('h1').innerText(), /Bristol Hawks/);
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute('href'),
    'https://www.tumblebase.com/clubs/south-west/bristol-hawks-gymnastics-club/'
  );
  assert.match(
    await page.getByRole('link', { name: 'Request a correction by email' }).getAttribute('href'),
    /^mailto:/
  );
  await page.screenshot({ path: '/tmp/tb-directory-club.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    '/clubs/',
    '/clubs/wales/',
    '/clubs/scotland/city-of-edinburgh-gymnastics-club/',
  ]) {
    await page.goto(`${base}${path}`);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      `Horizontal overflow: ${path}`
    );
  }
  await page.goto(`${base}/clubs/`);
  await page.screenshot({ path: '/tmp/tb-directory-mobile.png' });
  assert.deepEqual(errors, []);
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await plain.newPage();
  await nojs.goto(`${base}/clubs/`);
  assert.equal(await nojs.locator('[data-club]:visible').count(), 100);
  assert.equal(await nojs.locator('#club-filters').isVisible(), false);
  const missing = await nojs.goto(`${base}/clubs/does-not-exist/`);
  assert.equal(missing.status(), 404);
  await plain.close();
  console.log(
    'Directory browser checks passed: search, combined filters, empty/reset states, source/correction links, canonical URL, mobile layout, no-JS discovery and 404.'
  );
} finally {
  await browser.close();
}
