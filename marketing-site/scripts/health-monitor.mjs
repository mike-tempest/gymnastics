#!/usr/bin/env node
// health-monitor.mjs
// ----------------------------------------------------------------------------
// Live site-health monitor for the Swimly marketing site.
//
// Swimly is built once and then deploy-split across two domains:
//   - UK pages live at the output root and ship to swimly.uk
//   - us/, ca/, au/ ship to swimly.club
// (swimly.info is an http-only forwarder that redirects to swimly.club.)
//
// This script performs READ-ONLY live HTTP checks against the deployed sites
// and asserts that both domains are healthy. It never writes, builds or
// deploys anything. It exits 0 when every hard check passes and non-zero
// (printing a clear list of failures) when any hard check fails. Warnings do
// not fail the run.
//
// Checks:
//   1. https://swimly.uk/ returns 200 and its canonical host is
//      https://swimly.uk.
//   2. https://swimly.club/, /us/, /ca/, /au/ each return 200, their canonical
//      host is https://swimly.club, and the canonical path matches the page.
//   3. On each swimly.club region page, <html lang> matches the region locale
//      (us -> en-US, ca -> en-CA, au -> en-AU) and the first referenced
//      /_astro/*.css bundle returns 200 (proves styling/assets are deployed).
//   4. hreflang reciprocity: both https://swimly.uk/ and https://swimly.club/us/
//      advertise hreflang alternates for en-GB, en-US, en-CA, en-AU and
//      x-default.
//   5. No "/intl/" substring appears in any fetched page's HTML (the internal
//      build path must never leak).
//   6. http://swimly.info/ returns a 3xx redirect whose Location points at
//      https://swimly.club/. This is a WARNING, not a hard failure: the
//      forwarder is http-only and may be reconfigured.
//
// Usage:
//   node scripts/health-monitor.mjs
//
// Uses Node built-ins only (global fetch on Node 20+). No external deps.

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const UK_HOST = 'https://swimly.uk';
const CLUB_HOST = 'https://swimly.club';
const INFO_URL = 'http://swimly.info/';

// Per-request timeout in milliseconds.
const TIMEOUT_MS = 15000;

// Hreflang values every globally-routed page must advertise.
const HREFLANG_REQUIRED = ['en-GB', 'en-US', 'en-CA', 'en-AU', 'x-default'];

// swimly.club region pages: path on the club host -> expected <html lang>.
const CLUB_REGIONS = [
  { path: '/us/', locale: 'en-US' },
  { path: '/ca/', locale: 'en-CA' },
  { path: '/au/', locale: 'en-AU' },
];

// ---------------------------------------------------------------------------
// Result accumulation
// ---------------------------------------------------------------------------

const failures = [];
const warnings = [];

// Record and print a single check result. `level` is 'fail' (hard) or 'warn'.
function record(ok, label, detail, level = 'fail') {
  if (ok) {
    console.log(`[PASS] ${label}`);
    return;
  }
  const line = detail ? `${label} (${detail})` : label;
  if (level === 'warn') {
    console.log(`[WARN] ${line}`);
    warnings.push(line);
  } else {
    console.log(`[FAIL] ${line}`);
    failures.push(line);
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

// Fetch a URL with a hard timeout. Returns { ok, status, text, headers, error }.
// Never throws: network and timeout errors are returned in `error` so a single
// unreachable URL surfaces as a clear failure rather than crashing the run.
async function get(url, { redirect = 'follow' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect,
      signal: controller.signal,
      headers: { 'user-agent': 'swimly-health-monitor' },
    });
    // Read the body for non-redirect responses; for manual-redirect responses
    // the body is empty and irrelevant, so skip it.
    const text = redirect === 'manual' ? '' : await res.text();
    return {
      ok: true,
      status: res.status,
      text,
      headers: res.headers,
      error: null,
    };
  } catch (err) {
    const reason = err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : err.message;
    return { ok: false, status: 0, text: '', headers: null, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// HTML parsing helpers (regex-based, tolerant of minified markup)
// ---------------------------------------------------------------------------

// Return the canonical URL string, or null when no canonical link is present.
function readCanonical(html) {
  const tag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i);
  if (!tag) return null;
  const href = tag[0].match(/\bhref=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

// Return the value of <html lang="...">, or null when absent.
function readHtmlLang(html) {
  const tag = html.match(/<html\b[^>]*>/i);
  if (!tag) return null;
  const lang = tag[0].match(/\blang=["']([^"']+)["']/i);
  return lang ? lang[1] : null;
}

// Collect the set of hreflang values present in the markup. Requires
// whitespace before the attribute so it does not match data-hreflang lookalikes.
function findHreflangs(html) {
  const present = new Set();
  const re = /\shreflang=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) present.add(m[1]);
  return present;
}

// Return the first referenced /_astro/*.css href, or null when none is found.
function findAstroCss(html) {
  const m = html.match(/href=["']([^"']*\/_astro\/[^"']+\.css)["']/i);
  return m ? m[1] : null;
}

// Resolve a possibly-relative href against a base page URL. Returns null on a
// malformed href rather than throwing.
function resolveUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

// Fetch a page, assert it returns 200 and that "/intl/" does not leak. Returns
// the response text on a 200, or null otherwise (so callers can skip dependent
// checks). The /intl/ guard runs against whatever HTML came back.
async function fetchPage(url, label) {
  const res = await get(url);
  if (!res.ok) {
    record(false, `${label} reachable`, res.error);
    return null;
  }
  record(res.status === 200, `${label} returns 200`, `got ${res.status}`);

  // Guard against the internal build path leaking, even on a non-200 body.
  if (res.text) {
    record(!res.text.includes('/intl/'), `${label} has no "/intl/" leak`);
  }

  return res.status === 200 ? res.text : null;
}

// Assert a page's canonical host and (optionally) its exact path.
function checkCanonical(html, label, expectedHost, expectedPath) {
  const canonical = readCanonical(html);
  if (!canonical) {
    record(false, `${label} has a canonical link`, 'none found');
    return;
  }
  let parsed;
  try {
    parsed = new URL(canonical);
  } catch {
    record(false, `${label} canonical is a valid URL`, canonical);
    return;
  }
  record(
    parsed.origin === expectedHost,
    `${label} canonical host is ${expectedHost}`,
    `got ${parsed.origin}`,
  );
  if (expectedPath !== undefined) {
    record(
      parsed.pathname === expectedPath,
      `${label} canonical path is ${expectedPath}`,
      `got ${parsed.pathname}`,
    );
  }
}

// Assert a page advertises the full required hreflang cluster.
function checkHreflang(html, label) {
  const present = findHreflangs(html);
  const missing = HREFLANG_REQUIRED.filter((h) => !present.has(h));
  record(
    missing.length === 0,
    `${label} advertises all hreflang alternates`,
    missing.length ? `missing ${missing.join(', ')}` : '',
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Swimly site-health monitor: starting live read-only checks.\n');

  // --- swimly.uk homepage ---------------------------------------------------
  console.log('-- swimly.uk --');
  const ukHome = await fetchPage(`${UK_HOST}/`, 'swimly.uk /');
  if (ukHome) {
    checkCanonical(ukHome, 'swimly.uk /', UK_HOST, '/');
    checkHreflang(ukHome, 'swimly.uk /');
  }

  // --- swimly.club homepage -------------------------------------------------
  console.log('\n-- swimly.club --');
  const clubHome = await fetchPage(`${CLUB_HOST}/`, 'swimly.club /');
  if (clubHome) {
    checkCanonical(clubHome, 'swimly.club /', CLUB_HOST, '/');
  }

  // --- swimly.club region pages --------------------------------------------
  for (const { path, locale } of CLUB_REGIONS) {
    console.log(`\n-- swimly.club ${path} --`);
    const url = `${CLUB_HOST}${path}`;
    const label = `swimly.club ${path}`;
    const html = await fetchPage(url, label);
    if (!html) continue;

    checkCanonical(html, label, CLUB_HOST, path);

    // <html lang> must match the region locale.
    const lang = readHtmlLang(html);
    record(lang === locale, `${label} <html lang> is ${locale}`, `got ${lang ?? 'none'}`);

    // The referenced CSS bundle must be deployed (proves styling/assets shipped).
    const cssHref = findAstroCss(html);
    if (!cssHref) {
      record(false, `${label} references an /_astro/*.css bundle`, 'none found');
    } else {
      const cssUrl = resolveUrl(cssHref, url);
      if (!cssUrl) {
        record(false, `${label} CSS href is a valid URL`, cssHref);
      } else {
        const css = await get(cssUrl);
        if (!css.ok) {
          record(false, `${label} CSS bundle reachable`, css.error);
        } else {
          record(css.status === 200, `${label} CSS bundle returns 200`, `got ${css.status}`);
        }
      }
    }

    // hreflang reciprocity is asserted on /us/ specifically, mirroring the UK home.
    if (path === '/us/') {
      checkHreflang(html, label);
    }
  }

  // --- swimly.info forwarder (warning only) --------------------------------
  console.log('\n-- swimly.info (forwarder) --');
  const info = await get(INFO_URL, { redirect: 'manual' });
  if (!info.ok) {
    record(false, 'swimly.info redirects to swimly.club', info.error, 'warn');
  } else {
    const isRedirect = info.status >= 300 && info.status < 400;
    if (!isRedirect) {
      record(false, 'swimly.info returns a 3xx redirect', `got ${info.status}`, 'warn');
    } else {
      const location = info.headers.get('location') || '';
      let target = null;
      try {
        target = new URL(location, INFO_URL).href;
      } catch {
        target = null;
      }
      // Accept the club host with or without a trailing slash on the redirect.
      const ok = target === `${CLUB_HOST}/` || target === CLUB_HOST;
      record(
        ok,
        `swimly.info redirects to ${CLUB_HOST}/`,
        `got ${location || 'no Location header'}`,
        'warn',
      );
    }
  }

  // --- Summary --------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log(
    `Summary: ${failures.length} failure(s), ${warnings.length} warning(s).`,
  );
  if (warnings.length > 0) {
    console.log('\nWarnings (non-fatal):');
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (failures.length > 0) {
    console.error('\nHEALTH CHECK FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nAll health checks passed.');
}

main().catch((err) => {
  // A defensive catch-all: any unexpected error is a hard failure.
  console.error(`\nHEALTH CHECK ERRORED: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
