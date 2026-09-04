#!/usr/bin/env node
/**
 * Regional demo fixture for the swimly.club product screenshots.
 *
 * The shared demo club is a UK club: it bills in GBP, its swimmers carry Swim
 * England registration numbers, and its sessions and invoices sit months in the
 * past, so the dashboard renders empty states. None of that represents the
 * product to a club in Denver or Brisbane.
 *
 * This script rewrites a scratch copy of the demo database so the club really
 * is a club in the target region, then the capture script photographs the app
 * with no interception at all. It is destructive and is meant to run only
 * against a throwaway database (default: swimly_screenshots).
 *
 *   node scripts/screenshot-fixture.mjs us
 *
 * Override the target with SCREENSHOT_DB and SCREENSHOT_DB_CONTAINER.
 */

import { execFileSync } from 'child_process';

const DB = process.env.SCREENSHOT_DB || 'swimly_screenshots';
const CONTAINER = process.env.SCREENSHOT_DB_CONTAINER || 'swim-nexus-db';
const CLUB_ID = process.env.SCREENSHOT_CLUB_ID || 'c4f5716b-371b-404f-8059-f2bfc3569c1d';

/**
 * Region profiles. The governing bodies and payment wording are the ones the
 * app already models in GOVERNING_BODY_LABELS and the region config, so the
 * fixture only supplies values the product would genuinely hold.
 */
const REGIONS = {
  us: {
    club: 'Riverside Swim Team',
    slug: 'riverside-swim-team',
    country: 'US',
    currency: 'USD',
    timezone: 'America/New_York',
    locale: 'en-US',
    governingBody: 'USA_SWIMMING',
    governingBodyRegion: 'Middle Atlantic Swimming',
    affiliation: 'MA-4471',
    memberPrefix: 'US',
    invoicePrefix: 'RST',
    venue: 'Riverside Aquatic Center, 1400 Delaware Ave, Buffalo NY 14209',
    email: 'office@riversideswimteam.org',
    website: 'https://www.riversideswimteam.org',
  },
  ca: {
    club: 'Lakeshore Swim Club',
    slug: 'lakeshore-swim-club',
    country: 'CA',
    currency: 'CAD',
    timezone: 'America/Toronto',
    locale: 'en-CA',
    governingBody: 'SWIMMING_CANADA',
    governingBodyRegion: 'Swim Ontario',
    affiliation: 'ON-2286',
    memberPrefix: 'CA',
    invoicePrefix: 'LSC',
    venue: 'Lakeshore Aquatic Centre, 3185 Lakeshore Rd W, Oakville ON L6L 1J2',
    email: 'office@lakeshoreswim.ca',
    website: 'https://www.lakeshoreswim.ca',
  },
  au: {
    club: 'Sunshine Coast Swimming Club',
    slug: 'sunshine-coast-swimming-club',
    country: 'AU',
    currency: 'AUD',
    timezone: 'Australia/Brisbane',
    locale: 'en-AU',
    governingBody: 'SWIMMING_AUSTRALIA',
    governingBodyRegion: 'Swimming Queensland',
    affiliation: 'QLD-1903',
    memberPrefix: 'AU',
    invoicePrefix: 'SCS',
    venue: 'Sunshine Coast Aquatic Centre, 110 Sportsmans Pde, Bokarina QLD 4575',
    email: 'office@sunshinecoastswim.org.au',
    website: 'https://www.sunshinecoastswim.org.au',
  },
};

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8' },
  );
}

/** Single-quote escaping for the literals this script builds. */
function q(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSql(region) {
  const r = REGIONS[region];

  return `
BEGIN;

-- The club itself, as a club in ${r.country} would be set up.
UPDATE clubs SET
  name = ${q(r.club)},
  slug = ${q(r.slug)},
  country = ${q(r.country)},
  currency = ${q(r.currency)},
  timezone = ${q(r.timezone)},
  locale = ${q(r.locale)},
  governing_body = ${q(r.governingBody)},
  governing_body_region = ${q(r.governingBodyRegion)},
  affiliation_number = ${q(r.affiliation)},
  contact_email = ${q(r.email)},
  website = ${q(r.website)},
  -- Swim England fields are UK-only and must not leak into a non-GB club.
  swim_england_region = NULL,
  swim_england_affiliate_number = NULL,
  county = NULL
WHERE id = ${q(CLUB_ID)};

-- Invoice rows carry their own currency and the billing table renders that in
-- preference to the club's, so leaving them in GBP puts pound rows underneath
-- dollar summary cards. The numbers are prefixed with the UK club's initials,
-- which the parent portal shows in full.
UPDATE invoices SET
  currency = ${q(r.currency)},
  invoice_number = ${q(r.invoicePrefix)} || substring(invoice_number from 4)
WHERE club_id = ${q(CLUB_ID)};

-- Every session is at a Tunbridge Wells address, which the attendance and
-- session detail views print verbatim.
UPDATE sessions SET location = ${q(r.venue)} WHERE club_id = ${q(CLUB_ID)};

-- Swimmer registrations belong to the region's governing body.
UPDATE swimmers SET
  governing_body = ${q(r.governingBody)},
  se_number = ${q(r.memberPrefix)} || substring(se_number from 3)
WHERE club_id = ${q(CLUB_ID)} AND se_number IS NOT NULL;

-- The seed puts every session one day before the evening it is named for
-- ("Learn to Swim - Monday Evening" falls on a Sunday), which reads as a bug in
-- a screenshot. Move each session onto the weekday in its own title. The
-- (+10) % 7 - 3 folds the difference into the nearest match either side.
UPDATE sessions s SET session_date = s.session_date + (
  ((CASE
      WHEN s.session_name ILIKE '%Sunday%' THEN 0
      WHEN s.session_name ILIKE '%Monday%' THEN 1
      WHEN s.session_name ILIKE '%Tuesday%' THEN 2
      WHEN s.session_name ILIKE '%Wednesday%' THEN 3
      WHEN s.session_name ILIKE '%Thursday%' THEN 4
      WHEN s.session_name ILIKE '%Friday%' THEN 5
      WHEN s.session_name ILIKE '%Saturday%' THEN 6
    END) - EXTRACT(DOW FROM s.session_date)::int + 10) % 7 - 3
)
WHERE s.club_id = ${q(CLUB_ID)}
  AND s.session_name ~* '(sun|mon|tues|wednes|thurs|fri|satur)day';

-- Move the season so it straddles today: roughly five weeks of completed
-- sessions behind us and two weeks of scheduled ones ahead. Without this the
-- whole dataset sits months in the past and every dashboard card is an empty
-- state.
--
-- The shift is rounded up to whole weeks so the timetable keeps its weekdays.
-- Sessions are named for the evening they run on ("Development Squad - Monday
-- Evening"), and an arbitrary day offset lands them on the wrong weekday.
WITH shift AS (
  SELECT CEIL((((CURRENT_DATE + INTERVAL '14 days')::date - MAX(session_date))) / 7.0)::int * 7 AS days
  FROM sessions WHERE club_id = ${q(CLUB_ID)}
)
UPDATE sessions s SET
  session_date = s.session_date + (SELECT days FROM shift),
  status = CASE
    WHEN s.session_date + (SELECT days FROM shift) < CURRENT_DATE THEN 'completed'::sessions_status_enum
    ELSE 'scheduled'::sessions_status_enum
  END
WHERE s.club_id = ${q(CLUB_ID)};

-- Attendance timestamps follow their session, so the week's register reads as
-- a club that is actually training.
UPDATE attendance a SET checked_in_at = (s.session_date + a.checked_in_at::time)
FROM sessions s
WHERE a.session_id = s.session_id
  AND a.club_id = ${q(CLUB_ID)}
  AND a.checked_in_at IS NOT NULL;

-- Attendance may only exist for sessions that have happened.
DELETE FROM attendance a USING sessions s
WHERE a.session_id = s.session_id
  AND a.club_id = ${q(CLUB_ID)}
  AND s.session_date >= CURRENT_DATE;

-- Bring billing into the current month so "this month" shows real collection
-- rather than "No billing activity yet".
--
-- The two screens count late payment differently: the billing page counts rows
-- whose status is 'overdue', while the dashboard counts rows that are still
-- 'pending' but past their due date (InvoicesRepository.findOverdue). Both need
-- rows to land on, so one pending invoice is deliberately left past due.
UPDATE invoices SET
  issued_date = date_trunc('month', CURRENT_DATE)::date + 2,
  due_date = CASE
    WHEN status = 'overdue' THEN CURRENT_DATE - 9
    WHEN status = 'pending' AND invoice_number = (
      SELECT MIN(invoice_number) FROM invoices
      WHERE club_id = ${q(CLUB_ID)} AND status = 'pending'
    ) THEN CURRENT_DATE - 4
    ELSE CURRENT_DATE + 12
  END
WHERE club_id = ${q(CLUB_ID)};

COMMIT;
`;
}

function main() {
  const region = process.argv[2];

  if (!REGIONS[region]) {
    console.error(`Usage: node scripts/screenshot-fixture.mjs <${Object.keys(REGIONS).join('|')}>`);
    process.exit(1);
  }

  if (DB !== 'swimly_screenshots' && !process.env.SCREENSHOT_DB_CONFIRM) {
    console.error(
      `Refusing to rewrite "${DB}". This fixture is destructive and expects a scratch\n` +
        'database. Set SCREENSHOT_DB_CONFIRM=1 if that really is the target.',
    );
    process.exit(1);
  }

  psql(buildSql(region));

  const summary = psql(
    `SELECT c.name, c.country, c.currency, c.locale,
       (SELECT count(*) FROM sessions WHERE club_id = c.id AND session_date >= CURRENT_DATE) AS upcoming,
       (SELECT count(*) FROM attendance WHERE club_id = c.id) AS attendance
     FROM clubs c WHERE c.id = ${q(CLUB_ID)};`,
  );

  console.log(`Fixture applied for ${region}:`);
  console.log(summary.trim());
}

main();
