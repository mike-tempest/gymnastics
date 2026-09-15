// Run against the production container: node marketing-site/scripts/test-directory.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const clubs = JSON.parse(readFileSync(new URL('../site/data/clubs.json', import.meta.url), 'utf8'));
const total = clubs.length;
const mapped = clubs.filter((club) => club.mapLocation).length;
const northernIreland = clubs.filter((club) => club.nation === 'Northern Ireland');
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const base = process.env.DIRECTORY_TEST_URL || 'http://127.0.0.1:4180';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // Keep browser regression tests off the community tile service.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=',
        'base64'
      ),
    })
  );
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/clubs/`);
  await page.waitForSelector('#club-filters:visible');
  assert.equal(await page.locator('[data-club]:visible').count(), total);
  await page.getByRole('button', { name: 'Map view', exact: true }).click();
  await page.waitForSelector('.leaflet-marker-icon');
  assert.match(
    await page.locator('#map-status').innerText(),
    new RegExp(`${mapped} of ${total} matching clubs mapped`)
  );
  assert.equal(await page.locator('#club-results').isVisible(), false);
  await page.getByLabel('Club, town or postcode').fill('Bristol Hawks');
  assert.match(await page.locator('#map-status').innerText(), /1 of 1 matching clubs mapped/);
  await page.locator('.leaflet-marker-icon').click();
  assert.equal(
    await page
      .locator('.leaflet-popup')
      .getByRole('link', { name: 'Bristol Hawks Gymnastics Club', exact: true })
      .count(),
    1
  );
  await page.getByLabel('Club, town or postcode').fill('not-a-real-club-zzzz');
  assert.equal(await page.locator('.leaflet-marker-icon').count(), 0);
  assert.match(await page.locator('#map-status').innerText(), /0 of 0/);
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await page.getByLabel('Club, town or postcode').fill('bristol');
  assert.equal(
    await page.locator('[data-club]:visible').count(),
    clubs.filter((club) =>
      [club.name, club.town, ...club.addresses].join(' ').toLowerCase().includes('bristol')
    ).length
  );
  await page.getByLabel('Area', { exact: true }).selectOption('Wales');
  assert.equal(await page.locator('[data-club]:visible').count(), 0);
  assert.equal(await page.locator('#club-empty').isVisible(), true);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.waitForFunction(
    (count) => document.querySelector('#club-count').textContent === `Showing ${count} clubs`,
    total
  );
  await page.getByLabel('Area', { exact: true }).selectOption('Scotland');
  await page.getByLabel('Discipline or programme').selectOption('Trampoline');
  const filtered = await page.locator('[data-club]:visible').evaluateAll((elements) =>
    elements.map((element) => ({
      region: element.dataset.region,
      disciplines: JSON.parse(element.dataset.disciplines),
    }))
  );
  assert.ok(
    filtered.length > 0 &&
      filtered.length < clubs.filter((club) => club.region === 'Scotland').length
  );
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
  await page.getByRole('button', { name: 'Map view', exact: true }).click();
  await page.waitForSelector('.leaflet-marker-icon');
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'Mobile map overflow'
  );
  await page.getByLabel('Area', { exact: true }).selectOption('Northern Ireland');
  assert.match(
    await page.locator('#map-status').innerText(),
    new RegExp(
      `${northernIreland.filter((club) => club.mapLocation).length} of ${northernIreland.length} matching clubs mapped`
    )
  );
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.waitForFunction(
    (prefix) => document.querySelector('#map-status').textContent.startsWith(prefix),
    `${mapped} of ${total}`
  );
  assert.deepEqual(errors, []);
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await plain.newPage();
  await nojs.goto(`${base}/clubs/`);
  assert.equal(await nojs.locator('[data-club]:visible').count(), total);
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
