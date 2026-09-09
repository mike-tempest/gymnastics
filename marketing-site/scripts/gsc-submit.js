#!/usr/bin/env node

/**
 * Google Search Console URL Submission Tool
 * Submits URLs to Google Indexing API after deployment
 */

import { readFile, writeFile, access } from 'fs/promises';
import { google } from 'googleapis';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const CREDENTIALS_PATH = resolve(process.env.HOME, '.config/google/clawd-docs.json');
const SITEMAP_INDEX = resolve(__dirname, '../dist/sitemap-index.xml');
const DAILY_QUOTA_LIMIT = 200;
const STATE_FILE = resolve(__dirname, '.gsc-submit-state.json');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const limit = args.find((arg) => arg.startsWith('--limit='));
  const offset = args.find((arg) => arg.startsWith('--offset='));
  const auto = args.includes('--auto');
  return {
    limit: limit ? parseInt(limit.split('=')[1]) : DAILY_QUOTA_LIMIT,
    offset: offset ? parseInt(offset.split('=')[1]) : 0,
    auto,
  };
}

/**
 * Authenticate with Google APIs
 */
async function authenticate() {
  try {
    const credentials = JSON.parse(await readFile(CREDENTIALS_PATH, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    return await auth.getClient();
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    console.error('   Credentials file:', CREDENTIALS_PATH);
    process.exit(1);
  }
}

/**
 * Fetch and parse XML from URL or file
 */
async function fetchXML(urlOrPath) {
  try {
    if (urlOrPath.startsWith('http')) {
      const response = await fetch(urlOrPath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } else {
      return await readFile(urlOrPath, 'utf8');
    }
  } catch (error) {
    throw new Error(`Failed to fetch ${urlOrPath}: ${error.message}`);
  }
}

/**
 * Extract URLs from sitemap XML
 */
function extractURLs(xml) {
  const urls = [];

  // Extract <loc> tags
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;

  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }

  return urls;
}

/**
 * Read all URLs from sitemaps
 */
async function getAllURLs() {
  try {
    console.log('📄 Reading sitemap index:', SITEMAP_INDEX);
    const indexXML = await fetchXML(SITEMAP_INDEX);
    const sitemapURLs = extractURLs(indexXML);

    console.log(`   Found ${sitemapURLs.length} sitemaps`);

    const allURLs = [];

    for (const sitemapURL of sitemapURLs) {
      try {
        const sitemapXML = await fetchXML(sitemapURL);
        const urls = extractURLs(sitemapXML);
        allURLs.push(...urls);
        console.log(`   ✓ ${sitemapURL}: ${urls.length} URLs`);
      } catch (error) {
        console.error(`   ✗ ${sitemapURL}: ${error.message}`);
      }
    }

    return allURLs;
  } catch (error) {
    console.error('❌ Failed to read sitemaps:', error.message);
    process.exit(1);
  }
}

/**
 * Submit URL to Google Indexing API
 */
async function submitURL(auth, url) {
  const indexing = google.indexing({ version: 'v3', auth });

  try {
    await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: 'URL_UPDATED',
      },
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}

/**
 * Main execution
 */
/**
 * Load/save state for --auto mode (tracks offset across daily runs)
 */
async function loadState() {
  try {
    await access(STATE_FILE);
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    return { offset: 0, lastRun: null, totalURLs: 0 };
  }
}

async function saveState(state) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  const { limit, offset: manualOffset, auto } = parseArgs();

  // In auto mode, load offset from state file
  let offset = manualOffset;
  let state = null;
  if (auto) {
    state = await loadState();
    offset = state.offset;
  }

  console.log('🔍 Google Search Console URL Submission');
  console.log('   Site: https://swimly.uk');
  console.log(`   Quota limit: ${limit}/day`);
  if (offset > 0) console.log(`   Offset: ${offset}`);
  if (auto) console.log('   Mode: auto (tracking progress)');
  console.log();

  // Authenticate
  const auth = await authenticate();
  console.log('✓ Authenticated\n');

  // Get all URLs
  const urls = await getAllURLs();
  console.log(`\n📊 Total URLs found: ${urls.length}\n`);

  if (urls.length === 0) {
    console.log('No URLs to submit');
    return;
  }

  // If offset is past the end, we've submitted everything - reset
  if (offset >= urls.length) {
    console.log('✓ All URLs have been submitted. Resetting offset to 0.\n');
    offset = 0;
  }

  // Submit URLs from offset
  const toSubmit = urls.slice(offset, offset + limit);
  console.log(
    `📤 Submitting URLs ${offset + 1}-${offset + toSubmit.length} of ${urls.length}...\n`
  );

  let submitted = 0;
  let skipped = 0;
  let errors = [];

  for (let i = 0; i < toSubmit.length; i++) {
    const url = toSubmit[i];
    process.stdout.write(`   [${i + 1}/${toSubmit.length}] ${url.substring(0, 60)}...`);

    const result = await submitURL(auth, url);

    if (result.success) {
      console.log(' ✓');
      submitted++;
    } else {
      console.log(` ✗ ${result.error}`);
      errors.push({ url, error: result.error });

      // If quota exceeded, stop
      if (result.code === 429 || result.error.includes('quota')) {
        console.log('\n⚠️  Quota limit reached, stopping');
        break;
      }
    }

    // Rate limiting: small delay between requests
    if (i < toSubmit.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const remaining = urls.length - (offset + toSubmit.length);

  // Save state for auto mode
  if (auto) {
    const newOffset = offset + submitted;
    await saveState({
      offset: newOffset,
      lastRun: new Date().toISOString(),
      totalURLs: urls.length,
    });
    console.log(`\n   State saved: next run starts at URL ${newOffset + 1}`);
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log('✓ Submission complete\n');
  console.log(`   Submitted: ${submitted}`);
  if (remaining > 0) console.log(`   Remaining: ${remaining}`);
  if (errors.length > 0) console.log(`   Errors:    ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ url, error }) => {
      console.log(`   ${url}`);
      console.log(`   └─ ${error}`);
    });
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
