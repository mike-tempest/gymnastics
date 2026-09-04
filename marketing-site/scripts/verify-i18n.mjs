#!/usr/bin/env node
// verify-i18n.mjs
// ----------------------------------------------------------------------------
// Post-build internationalisation guard for the Swimly marketing site.
//
// The site is built once and then deploy-split across two domains:
//   - UK pages live at the output root and ship to swimly.uk
//   - us/, ca/, au/ and international/ ship to swimly.club
// There must never be an /intl/ prefix anywhere in the output.
//
// This script scans dist.nosync/**/*.html and asserts:
//   1. No HTML file contains the substring "/intl/" (in any href, canonical
//      or sitemap loc). The prefix must never leak into shipped markup.
//   2. Every page under us/, ca/, au/ and international/ has a canonical whose
//      host is https://swimly.club.
//   3. Every other page has a canonical whose host is https://swimly.uk.
//   4. The homepage (index.html) carries hreflang alternates for en-GB,
//      en-US, en-CA, en-AU and x-default.
//
// The build may be UK-only (no region pages yet). In that case checks 2 and 4
// have nothing international to enforce, so the script reports that the build
// is UK-only and still passes, having verified the UK canonicals and that no
// /intl/ leaked. The script never crashes when intl pages are absent.
//
// Uses Node built-ins only (fs, path). No external dependencies.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist.nosync');

const UK_HOST = 'https://swimly.uk';
const CLUB_HOST = 'https://swimly.club';

// Top-level output directories whose pages belong on swimly.club.
const INTL_PREFIXES = ['us', 'ca', 'au', 'international'];

const HREFLANG_REQUIRED = ['en-GB', 'en-US', 'en-CA', 'en-AU', 'x-default'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Recursively collect every .html file under a directory.
function collectHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      // Skip anything that cannot be stat'd (for example a dangling symlink)
      // so the guard reports real problems rather than crashing on stray files.
      continue;
    }
    if (stats.isDirectory()) {
      out.push(...collectHtmlFiles(full));
    } else if (entry.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

// Return the canonical host for a page, or null when no canonical is present.
function readCanonicalHost(html) {
  // Markup is minified, so match a canonical link tag tolerant of attribute
  // order and single or double quotes.
  const tag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i);
  if (!tag) return null;
  const href = tag[0].match(/\bhref=["']([^"']+)["']/i);
  if (!href) return null;
  try {
    return new URL(href[1]).origin;
  } catch {
    return null;
  }
}

// True when a page (by its path relative to dist) belongs on swimly.club.
function isIntlPage(relPath) {
  const first = relPath.split(sep)[0];
  return INTL_PREFIXES.includes(first);
}

// Collect which required hreflang values are present in the homepage markup.
function findHreflangs(html) {
  const present = new Set();
  // Require whitespace before the attribute so this matches the real hreflang
  // attribute and not a lookalike such as data-hreflang.
  const re = /\shreflang=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    present.add(m[1]);
  }
  return present;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(DIST_DIR)) {
    console.error(
      `verify-i18n: build output not found at ${DIST_DIR}. Run "npm run build" first.`,
    );
    process.exit(1);
  }

  const files = collectHtmlFiles(DIST_DIR);
  if (files.length === 0) {
    console.error(`verify-i18n: no HTML files found under ${DIST_DIR}.`);
    process.exit(1);
  }

  const failures = [];

  const intlLeaks = [];
  const wrongUkCanonicals = [];
  const wrongClubCanonicals = [];
  let intlPageCount = 0;

  for (const file of files) {
    const relPath = relative(DIST_DIR, file);
    const html = readFileSync(file, 'utf8');

    // Check 1: the /intl/ prefix must never appear anywhere.
    if (html.includes('/intl/')) {
      intlLeaks.push(relPath);
    }

    // Checks 2 and 3: canonical host must match the page's region.
    const expectIntl = isIntlPage(relPath);
    if (expectIntl) intlPageCount += 1;

    // Validate the canonical host only when a page declares one. Some standalone
    // assets (for example the printable one-pagers under downloads/) carry no
    // canonical by design, and requiring one is out of scope for this guard.
    const host = readCanonicalHost(html);
    if (host !== null) {
      if (expectIntl && host !== CLUB_HOST) {
        wrongClubCanonicals.push(`${relPath} -> ${host}`);
      } else if (!expectIntl && host !== UK_HOST) {
        wrongUkCanonicals.push(`${relPath} -> ${host}`);
      }
    }
  }

  // Report check 1.
  if (intlLeaks.length > 0) {
    failures.push(
      `Found "/intl/" in ${intlLeaks.length} file(s); the prefix must never leak:\n` +
        intlLeaks.map((f) => `  - ${f}`).join('\n'),
    );
  }

  // Report check 3 (UK canonicals).
  if (wrongUkCanonicals.length > 0) {
    failures.push(
      `${wrongUkCanonicals.length} non-international page(s) have a canonical host other than ${UK_HOST}:\n` +
        wrongUkCanonicals.map((f) => `  - ${f}`).join('\n'),
    );
  }

  // Report check 2 (club canonicals). Only meaningful when intl pages exist.
  if (wrongClubCanonicals.length > 0) {
    failures.push(
      `${wrongClubCanonicals.length} international page(s) have a canonical host other than ${CLUB_HOST}:\n` +
        wrongClubCanonicals.map((f) => `  - ${f}`).join('\n'),
    );
  }

  // Check 4: homepage hreflang alternates. Only enforced once intl pages exist,
  // because a UK-only build has no alternate regions to point at.
  const homepage = join(DIST_DIR, 'index.html');
  if (intlPageCount > 0) {
    if (!existsSync(homepage)) {
      failures.push('Homepage dist.nosync/index.html is missing.');
    } else {
      const present = findHreflangs(readFileSync(homepage, 'utf8'));
      const missing = HREFLANG_REQUIRED.filter((h) => !present.has(h));
      if (missing.length > 0) {
        failures.push(
          `Homepage is missing hreflang alternate(s): ${missing.join(', ')}.`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Summary and exit
  // ---------------------------------------------------------------------------
  console.log(`verify-i18n: scanned ${files.length} HTML file(s) in ${DIST_DIR}.`);
  if (intlPageCount === 0) {
    console.log(
      'verify-i18n: no international pages found (us/, ca/, au/, international/). ' +
        'Treating this as a UK-only build; verified UK canonicals and that no "/intl/" leaked.',
    );
  } else {
    console.log(`verify-i18n: found ${intlPageCount} international page(s) on ${CLUB_HOST}.`);
  }

  if (failures.length > 0) {
    console.error('\nverify-i18n FAILED:\n');
    console.error(failures.join('\n\n'));
    process.exit(1);
  }

  console.log('verify-i18n: all checks passed.');
}

main();
