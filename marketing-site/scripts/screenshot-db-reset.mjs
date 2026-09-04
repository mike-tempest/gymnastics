#!/usr/bin/env node
/**
 * Rebuild the scratch screenshot database from the local demo database.
 *
 * The regional fixture rewrites the club in place, so captures must start from
 * a known-clean copy rather than from whatever the last region left behind.
 * Run this with the membership service stopped: Postgres will not drop a
 * database that still has connections open.
 *
 *   node scripts/screenshot-db-reset.mjs
 *
 * Override with SCREENSHOT_DB, SCREENSHOT_SOURCE_DB and
 * SCREENSHOT_DB_CONTAINER.
 */

import { execFileSync } from 'child_process';

const DB = process.env.SCREENSHOT_DB || 'swimly_screenshots';
const SOURCE = process.env.SCREENSHOT_SOURCE_DB || 'swimly_mt_dev';
const CONTAINER = process.env.SCREENSHOT_DB_CONTAINER || 'swim-nexus-db';

function psql(db, sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8' },
  );
}

if (DB === SOURCE) {
  console.error(`Refusing to rebuild "${DB}" from itself.`);
  process.exit(1);
}

psql('postgres', `DROP DATABASE IF EXISTS ${DB};`);
psql('postgres', `CREATE DATABASE ${DB} TEMPLATE ${SOURCE};`);

// The local demo database predates the regional columns, so the Club entity
// cannot load without them. Adding them here keeps the fixture working without
// running migrations against anyone's development database.
psql(
  DB,
  `ALTER TABLE clubs
     ADD COLUMN IF NOT EXISTS governing_body varchar(40),
     ADD COLUMN IF NOT EXISTS governing_body_region varchar(100),
     ADD COLUMN IF NOT EXISTS affiliation_number varchar(100),
     ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2),
     ADD COLUMN IF NOT EXISTS tax_label varchar(50),
     ADD COLUMN IF NOT EXISTS timezone varchar(64) NOT NULL DEFAULT 'Europe/London',
     ADD COLUMN IF NOT EXISTS locale varchar(10) NOT NULL DEFAULT 'en-GB';`,
);

console.log(`Rebuilt ${DB} from ${SOURCE}.`);
