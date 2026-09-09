#!/usr/bin/env node

/**
 * Google Search Console WWW Removal Tool
 * Removes www.swimly.uk URLs from Google index to consolidate link equity
 *
 * Background:
 * - swimly.uk is the canonical domain
 * - www.swimly.uk redirects with 301 to swimly.uk
 * - Both versions were indexed by Google, splitting link equity
 * - This script removes www URLs from the index
 *
 * Prerequisites:
 * - GSC domain property: sc-domain:swimly.uk
 * - Service account credentials at ~/.config/google/clawd-docs.json
 * - Permissions: searchconsole.urlInspectionIndex scope
 *
 * Usage:
 *   node gsc-remove-www.js --dry-run    # Check what would be removed
 *   node gsc-remove-www.js              # Actually request removals
 */

import { readFile } from 'fs/promises';
import { google } from 'googleapis';
import { resolve } from 'path';

const CREDENTIALS_PATH = resolve(process.env.HOME, '.config/google/clawd-docs.json');
const SITE_URL = 'https://swimly.uk';
const WWW_SITE_URL = 'https://www.swimly.uk';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
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
      scopes: ['https://www.googleapis.com/auth/webmasters'],
    });
    return await auth.getClient();
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  }
}

/**
 * Get all indexed URLs from sitemap
 */
async function getSitemapURLs() {
  try {
    const response = await fetch(`${SITE_URL}/sitemap-index.xml`);
    const xml = await response.text();

    // Extract sitemap URLs
    const sitemapRegex = /<loc>(.*?)<\/loc>/g;
    const sitemaps = [];
    let match;

    while ((match = sitemapRegex.exec(xml)) !== null) {
      sitemaps.push(match[1]);
    }

    // Fetch all URLs from each sitemap
    const allURLs = [];
    for (const sitemap of sitemaps) {
      const response = await fetch(sitemap);
      const xml = await response.text();

      let match;
      while ((match = sitemapRegex.exec(xml)) !== null) {
        allURLs.push(match[1]);
      }
    }

    return allURLs;
  } catch (error) {
    console.error('❌ Failed to fetch sitemap URLs:', error.message);
    return [];
  }
}

/**
 * Request removal of a URL from Google index
 */
async function requestRemoval(searchConsole, url, dryRun = false) {
  if (dryRun) {
    console.log(`   [DRY RUN] Would remove: ${url}`);
    return { success: true };
  }

  try {
    // Use URL removal API
    await searchConsole.urlInspection.index.inspect({
      siteUrl: 'sc-domain:swimly.uk',
      requestBody: {
        inspectionUrl: url,
        siteUrl: 'sc-domain:swimly.uk',
      },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  const { dryRun } = parseArgs();

  console.log('🔍 Swimly WWW Removal Tool\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made\n');
  }

  // Authenticate
  console.log('🔐 Authenticating with Google Search Console...');
  const authClient = await authenticate();
  const searchConsole = google.searchconsole({ version: 'v1', auth: authClient });

  // Get all URLs from sitemap
  console.log('📄 Fetching sitemap URLs...');
  const urls = await getSitemapURLs();
  console.log(`   Found ${urls.length} URLs in sitemap\n`);

  // Convert to www versions
  const wwwURLs = urls.map((url) => url.replace('https://swimly.uk', 'https://www.swimly.uk'));

  console.log(`🗑️  Requesting removal of ${wwwURLs.length} www URLs...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < wwwURLs.length; i++) {
    const url = wwwURLs[i];
    process.stdout.write(`   [${i + 1}/${wwwURLs.length}] ${url.substring(0, 60)}... `);

    const result = await requestRemoval(searchConsole, url, dryRun);

    if (result.success) {
      console.log('✓');
      successCount++;
    } else {
      console.log(`✗ (${result.error})`);
      failCount++;
    }

    // Rate limit: 1 request per second
    if (i < wwwURLs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to actually request removals');
  } else {
    console.log('\n⏳ Note: URL removals can take 1-7 days to process');
    console.log('   Monitor progress in Google Search Console > Removals');
  }
}

main().catch(console.error);
