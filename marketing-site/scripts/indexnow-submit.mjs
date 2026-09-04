#!/usr/bin/env node
/**
 * IndexNow submitter for swimly.uk (and swimly.club).
 *
 * IndexNow tells Bing, Yandex, Seznam and Naver that URLs have changed. Google
 * does not participate; use scripts/gsc-submit.js for that.
 *
 * The protocol only accepts a submission when a key file containing exactly the
 * key is reachable on the same host, so this script verifies the key file over
 * HTTP before it posts anything. A submission against a missing key file fails
 * with 403 and is easy to miss, which is why the check is not optional.
 *
 * Usage:
 *   node scripts/indexnow-submit.mjs --all              # every sitemap URL (first run only)
 *   node scripts/indexnow-submit.mjs --since 2026-07-01 # URLs with a lastmod on or after a date
 *   node scripts/indexnow-submit.mjs                    # URLs changed since the last recorded run
 *   node scripts/indexnow-submit.mjs --url https://swimly.uk/blog/foo/ --url ...
 *   node scripts/indexnow-submit.mjs --host swimly.club --all
 *
 * Add --dry-run to print the payload without sending it.
 *
 * IndexNow is for pages that were added, updated or removed. Resubmitting the
 * whole site on a schedule is what the protocol asks you not to do, so --all is
 * meant for the initial submission and the default path is incremental.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PUBLIC_DIR = join(ROOT, 'public');
const STATE_FILE = join(HERE, 'indexnow-state.json');

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10000;

function parseArgs(argv) {
  const opts = { host: 'swimly.uk', urls: [], all: false, since: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') opts.all = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--since') opts.since = argv[++i];
    else if (arg === '--host') opts.host = argv[++i];
    else if (arg === '--url') opts.urls.push(argv[++i]);
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

/** The key is whatever <32-hex>.txt sits in public/, so there is one source of truth. */
async function findKey() {
  const files = await readdir(PUBLIC_DIR);
  const keyFiles = files.filter((f) => /^[a-f0-9]{8,128}\.txt$/i.test(f));
  if (keyFiles.length === 0) {
    throw new Error(
      'No IndexNow key file found in public/. Create one with:\n' +
        '  KEY=$(openssl rand -hex 16); echo "$KEY" > public/"$KEY".txt',
    );
  }
  if (keyFiles.length > 1) {
    throw new Error(`Several key files in public/ (${keyFiles.join(', ')}). Keep exactly one.`);
  }
  const key = keyFiles[0].replace(/\.txt$/i, '');
  const contents = (await readFile(join(PUBLIC_DIR, keyFiles[0]), 'utf8')).trim();
  if (contents !== key) {
    throw new Error(`public/${keyFiles[0]} must contain exactly "${key}" but contains "${contents}".`);
  }
  return key;
}

/**
 * The key file has to be live on the host being submitted, not just in the repo.
 * Deploying is a separate step, so this catches the common failure of submitting
 * before the deploy has landed.
 */
async function verifyKeyIsLive(host, key) {
  const keyLocation = `https://${host}/${key}.txt`;
  let res;
  try {
    res = await fetch(keyLocation, { redirect: 'follow' });
  } catch (err) {
    throw new Error(`Could not fetch ${keyLocation}: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(
      `${keyLocation} returned HTTP ${res.status}. Deploy the key file with ./deploy-ftp.sh before submitting.`,
    );
  }
  const body = (await res.text()).trim();
  if (body !== key) {
    throw new Error(`${keyLocation} served "${body.slice(0, 60)}" instead of the key.`);
  }
  return keyLocation;
}

function extractTags(xml, tag) {
  const matches = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'g')) ?? [];
  return matches.map((m) => m.replace(new RegExp(`</?${tag}>`, 'g'), '').trim());
}

/** Walks the sitemap index and returns every URL with its lastmod, if it has one. */
async function collectSitemapUrls(host) {
  const indexUrl = `https://${host}/sitemap-index.xml`;
  const indexRes = await fetch(indexUrl);
  if (!indexRes.ok) throw new Error(`${indexUrl} returned HTTP ${indexRes.status}`);
  const children = extractTags(await indexRes.text(), 'loc');

  const entries = new Map();
  for (const child of children) {
    const res = await fetch(child);
    if (!res.ok) {
      console.warn(`  warning: ${child} returned HTTP ${res.status}, skipping`);
      continue;
    }
    const xml = await res.text();
    // Split on <url> so a loc keeps its own lastmod rather than the file's.
    for (const block of xml.split(/<url>/).slice(1)) {
      const [loc] = extractTags(block, 'loc');
      if (!loc) continue;
      const [lastmod] = extractTags(block, 'lastmod');
      entries.set(loc, lastmod ?? null);
    }
    console.log(`  ${child}: ${extractTags(xml, 'loc').length} URLs`);
  }
  return entries;
}

async function readState() {
  if (!existsSync(STATE_FILE)) return {};
  return JSON.parse(await readFile(STATE_FILE, 'utf8'));
}

async function writeState(state) {
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

async function submitBatch({ host, key, keyLocation, urlList, dryRun }) {
  const payload = { host, key, keyLocation, urlList };
  if (dryRun) {
    console.log(`\n[dry run] POST ${ENDPOINT}`);
    console.log(JSON.stringify({ ...payload, urlList: urlList.slice(0, 5) }, null, 2));
    console.log(`[dry run] urlList holds ${urlList.length} URLs (first 5 shown)`);
    return { ok: true, status: 0, dryRun: true };
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function explainStatus(status) {
  switch (status) {
    case 200:
      return 'OK, URLs accepted.';
    case 202:
      return 'Accepted, key still being validated. This is a normal first-run response.';
    case 400:
      return 'Bad request: the payload was malformed.';
    case 403:
      // A brand-new key returns 403 with SiteVerificationNotCompleted for a
      // while after the key file first goes live. That one is worth retrying;
      // a genuinely wrong key is not.
      return 'Forbidden: the key file did not validate on the host. If the key was only just deployed, wait and retry.';
    case 422:
      return 'Unprocessable: URLs do not belong to the host, or the key does not match.';
    case 429:
      return 'Rate limited: too many requests, try again later.';
    default:
      return 'Unexpected status.';
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(await readFile(fileURLToPath(import.meta.url), 'utf8').then((s) => s.split('*/')[0]));
    return;
  }

  const key = await findKey();
  console.log(`IndexNow key: ${key}`);
  console.log(`Host:         ${opts.host}`);

  const keyLocation = await verifyKeyIsLive(opts.host, key);
  console.log(`Key file:     ${keyLocation} verified live`);

  const state = await readState();
  let urlList;
  let mode;

  if (opts.urls.length > 0) {
    urlList = opts.urls;
    mode = 'explicit URLs';
  } else {
    console.log('\nReading sitemaps...');
    const entries = await collectSitemapUrls(opts.host);
    if (opts.all) {
      urlList = [...entries.keys()];
      mode = 'all sitemap URLs';
    } else {
      const since = opts.since ?? state[opts.host]?.lastRun?.slice(0, 10);
      if (!since) {
        throw new Error(
          'No previous run recorded and no --since given. Use --all for the first submission, ' +
            'or pass --since YYYY-MM-DD.',
        );
      }
      urlList = [...entries.entries()]
        .filter(([, lastmod]) => lastmod && lastmod.slice(0, 10) >= since)
        .map(([loc]) => loc);
      mode = `URLs with lastmod >= ${since}`;
    }
  }

  const offHost = urlList.filter((u) => new URL(u).host !== opts.host);
  if (offHost.length > 0) {
    throw new Error(`These URLs are not on ${opts.host}: ${offHost.slice(0, 3).join(', ')}`);
  }

  console.log(`\nSelected ${urlList.length} URLs (${mode}).`);
  if (urlList.length === 0) {
    console.log('Nothing to submit.');
    return;
  }

  let sent = 0;
  for (let i = 0; i < urlList.length; i += MAX_URLS_PER_REQUEST) {
    const batch = urlList.slice(i, i + MAX_URLS_PER_REQUEST);
    const result = await submitBatch({ host: opts.host, key, keyLocation, urlList: batch, dryRun: opts.dryRun });
    if (result.dryRun) {
      sent += batch.length;
      continue;
    }
    console.log(`\nHTTP ${result.status}: ${explainStatus(result.status)}`);
    if (result.body) console.log(`Response body: ${result.body.slice(0, 300) || '(empty)'}`);
    if (!result.ok) process.exitCode = 1;
    else sent += batch.length;
  }

  if (!opts.dryRun && sent > 0) {
    state[opts.host] = {
      lastRun: new Date().toISOString(),
      lastCount: sent,
      key,
    };
    await writeState(state);
    console.log(`\nSubmitted ${sent} URLs. Recorded in scripts/indexnow-state.json.`);
  }
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exitCode = 1;
});
