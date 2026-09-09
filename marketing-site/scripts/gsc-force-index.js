#!/usr/bin/env node

/**
 * Force index specific URLs via Google Indexing API
 */

import { readFile } from 'fs/promises';
import { google } from 'googleapis';
import { resolve } from 'path';

const CREDENTIALS_PATH = resolve(process.env.HOME, '.config/google/clawd-docs.json');

async function authenticate() {
  const credentials = JSON.parse(await readFile(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
  return await auth.getClient();
}

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
    return { success: false, error: error.message };
  }
}

async function main() {
  const urls = process.argv.slice(2);

  if (urls.length === 0) {
    console.log('Usage: node gsc-force-index.js <url1> <url2> ...');
    process.exit(1);
  }

  console.log('🔍 Force indexing URLs via Google Indexing API\n');

  const auth = await authenticate();
  console.log('✓ Authenticated\n');

  for (const url of urls) {
    process.stdout.write(`   ${url}...`);
    const result = await submitURL(auth, url);

    if (result.success) {
      console.log(' ✓');
    } else {
      console.log(` ✗ ${result.error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log('\n✓ Complete');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
