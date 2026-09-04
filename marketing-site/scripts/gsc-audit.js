#!/usr/bin/env node

/**
 * Google Search Console Index Coverage Audit
 * Checks indexing status of all URLs via URL Inspection API
 */

import { readFile, writeFile } from 'fs/promises';
import { google } from 'googleapis';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const CREDENTIALS_PATH = resolve(process.env.HOME, '.config/google/clawd-docs.json');
const SITEMAP_INDEX = resolve(__dirname, '../dist/sitemap-index.xml');
const SITE_URL = 'sc-domain:swimly.uk';
const REQUEST_DELAY_MS = 500; // Delay between requests to avoid rate limits

/**
 * Authenticate with Google APIs
 */
async function authenticate() {
  try {
    const credentials = JSON.parse(await readFile(CREDENTIALS_PATH, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
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
 * Inspect URL indexing status
 */
async function inspectURL(searchconsole, url) {
  try {
    const response = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: url,
        siteUrl: SITE_URL
      }
    });
    
    const result = response.data.inspectionResult;
    const indexStatus = result?.indexStatusResult;
    
    return {
      url,
      indexed: indexStatus?.coverageState === 'Submitted and indexed',
      coverageState: indexStatus?.coverageState || 'Unknown',
      verdict: indexStatus?.verdict || 'Unknown',
      crawledAs: indexStatus?.crawledAs || 'Unknown',
      lastCrawlTime: indexStatus?.lastCrawlTime || null,
      error: null
    };
  } catch (error) {
    return {
      url,
      indexed: false,
      coverageState: 'Error',
      verdict: 'Error',
      error: error.message
    };
  }
}

/**
 * Format date for filename
 */
function getDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Write results to CSV
 */
async function writeCSV(results, filename) {
  const problems = results.filter(r => !r.indexed || r.error);
  
  if (problems.length === 0) {
    console.log('   No problems found, skipping CSV');
    return;
  }
  
  const csv = [
    'URL,Indexed,Coverage State,Verdict,Crawled As,Last Crawl Time,Error',
    ...problems.map(r => [
      r.url,
      r.indexed ? 'Yes' : 'No',
      r.coverageState,
      r.verdict,
      r.crawledAs || '',
      r.lastCrawlTime || '',
      r.error || ''
    ].map(field => `"${field}"`).join(','))
  ].join('\n');
  
  await writeFile(filename, csv, 'utf8');
  console.log(`   Wrote ${problems.length} problem URLs to ${filename}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Google Search Console Index Coverage Audit');
  console.log(`   Site: ${SITE_URL}`);
  console.log(`   Delay between requests: ${REQUEST_DELAY_MS}ms\n`);
  
  // Authenticate
  const auth = await authenticate();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  console.log('✓ Authenticated\n');
  
  // Get all URLs
  const urls = await getAllURLs();
  console.log(`\n📊 Total URLs found: ${urls.length}\n`);
  
  if (urls.length === 0) {
    console.log('No URLs to audit');
    return;
  }
  
  // Inspect URLs
  console.log('🔎 Inspecting URLs...\n');
  
  const results = [];
  let indexed = 0;
  let notIndexed = 0;
  let errors = 0;
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const displayURL = url.length > 60 ? url.substring(0, 60) + '...' : url;
    process.stdout.write(`   [${i + 1}/${urls.length}] ${displayURL}`);
    
    const result = await inspectURL(searchconsole, url);
    results.push(result);
    
    if (result.error) {
      console.log(` ✗ ${result.error}`);
      errors++;
    } else if (result.indexed) {
      console.log(' ✓ Indexed');
      indexed++;
    } else {
      console.log(` ⚠️  ${result.coverageState}`);
      notIndexed++;
    }
    
    // Rate limiting
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }
  
  // Write CSV of problems
  const csvFilename = `gsc-audit-${getDateString()}.csv`;
  await writeCSV(results, csvFilename);
  
  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log('✓ Audit complete\n');
  console.log('   Summary:');
  console.log(`   ✓ Indexed:      ${indexed} (${Math.round(indexed / urls.length * 100)}%)`);
  console.log(`   ⚠️  Not indexed:  ${notIndexed} (${Math.round(notIndexed / urls.length * 100)}%)`);
  if (errors > 0) {
    console.log(`   ❌ Errors:       ${errors}`);
  }
  
  // Coverage states breakdown
  const states = {};
  results.forEach(r => {
    const state = r.coverageState;
    states[state] = (states[state] || 0) + 1;
  });
  
  if (Object.keys(states).length > 1) {
    console.log('\n   Coverage states:');
    Object.entries(states)
      .sort((a, b) => b[1] - a[1])
      .forEach(([state, count]) => {
        console.log(`   • ${state}: ${count}`);
      });
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
