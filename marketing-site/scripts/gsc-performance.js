#!/usr/bin/env node

/**
 * Google Search Console Performance Report
 * Gets clicks, impressions, CTR, position data
 */

import { readFile } from 'fs/promises';
import { google } from 'googleapis';
import { resolve } from 'path';

const CREDENTIALS_PATH = resolve(process.env.HOME, '.config/google/clawd-docs.json');
const SITE_URL = 'sc-domain:swimly.uk';
const DAYS_BACK = 28; // Last 28 days

async function authenticate() {
  const credentials = JSON.parse(await readFile(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  return await auth.getClient();
}

function getDateString(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

async function main() {
  console.log(`\n📊 GSC Performance Report (Last ${DAYS_BACK} days)\n`);

  const auth = await authenticate();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const startDate = getDateString(DAYS_BACK);
  const endDate = getDateString(0);

  // Overall performance
  const overall = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: [],
    },
  });

  const stats = overall.data.rows?.[0] || {};
  console.log('Overall Performance:');
  console.log(`  Clicks:       ${stats.clicks || 0}`);
  console.log(`  Impressions:  ${stats.impressions || 0}`);
  console.log(`  CTR:          ${((stats.ctr || 0) * 100).toFixed(2)}%`);
  console.log(`  Avg Position: ${(stats.position || 0).toFixed(1)}\n`);

  // Top queries
  const queries = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 20,
    },
  });

  console.log('Top 20 Queries by Clicks:\n');
  (queries.data.rows || []).forEach((row, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${row.keys[0]}`);
    console.log(
      `      Clicks: ${row.clicks} | Impressions: ${row.impressions} | Position: ${row.position.toFixed(1)}`
    );
  });

  // Top pages
  const pages = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 20,
    },
  });

  console.log('\n\nTop 20 Pages by Clicks:\n');
  (pages.data.rows || []).forEach((row, i) => {
    const url = new URL(row.keys[0]);
    const path = url.pathname;
    console.log(`  ${(i + 1).toString().padStart(2)}. ${path}`);
    console.log(
      `      Clicks: ${row.clicks} | Impressions: ${row.impressions} | Position: ${row.position.toFixed(1)}`
    );
  });

  console.log('\n');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
