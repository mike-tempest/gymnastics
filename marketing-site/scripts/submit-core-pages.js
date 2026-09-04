#!/usr/bin/env node
/**
 * Submit critical core pages to Google Indexing API (bypass daily quota)
 */

import { readFile } from 'fs/promises';
import { google } from 'googleapis';
import { resolve } from 'path';

const CREDENTIALS_PATH = resolve(process.env.HOME, '.config/google/clawd-docs.json');

const CORE_PAGES = [
  'https://swimly.uk/',
  'https://swimly.uk/features/',
  'https://swimly.uk/pricing/',
  'https://swimly.uk/about/',
  'https://swimly.uk/faq/',
  'https://swimly.uk/swim-school-management/',
  'https://swimly.uk/swimming-club-billing-software/',
  'https://swimly.uk/features/membership/',
  'https://swimly.uk/features/billing/',
  'https://swimly.uk/features/attendance/',
  'https://swimly.uk/features/compliance/',
  'https://swimly.uk/features/parent-portal/',
  'https://swimly.uk/features/mobile/',
  'https://swimly.uk/compare/swimclubmanager/',
  'https://swimly.uk/compare/teamunify/',
  'https://swimly.uk/compare/cluborganiser/',
  'https://swimly.uk/compare/gomotion/',
  'https://swimly.uk/compare/clubspark/'
];

async function authenticate() {
  const credentials = JSON.parse(await readFile(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/indexing']
  });
  return await auth.getClient();
}

async function submitURL(indexing, url) {
  try {
    await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type: 'URL_UPDATED'
      }
    });
    return { url, success: true };
  } catch (error) {
    return { url, success: false, error: error.message };
  }
}

async function main() {
  console.log(`\n🚀 Submitting ${CORE_PAGES.length} core pages to Google Indexing API\n`);
  
  const auth = await authenticate();
  const indexing = google.indexing({ version: 'v3', auth });
  
  const results = [];
  
  for (const url of CORE_PAGES) {
    process.stdout.write(`   ${url} ... `);
    const result = await submitURL(indexing, url);
    results.push(result);
    
    if (result.success) {
      console.log('✓');
    } else {
      console.log(`✗ ${result.error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n✓ Complete: ${successful} submitted, ${failed} failed\n`);
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
