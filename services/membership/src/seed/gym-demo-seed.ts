import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  AssessmentOutcomeResult,
  AwardProgressStatus,
  AwardSchemeSource,
  Discipline,
  ProgrammeFlag,
  SquadType,
} from '@club-manager/shared-types';

import { AppModule } from '../app.module';
import { DEFAULT_AWARD_SCHEMES } from '../modules/awards/awards.defaults';

/**
 * Demo seed for Kestrel Vale Gymnastics Club, the British Gymnastics demo club.
 *
 * Kestrel Vale is fictional. The club, its staff, its families and every
 * reference number below are invented; the addresses use real Charnwood
 * (Leicestershire) place names so the data reads like a real club's, and the
 * phone numbers come from the Ofcom drama range reserved for fiction.
 *
 * Follows the structure of the Australian demo seed (src/seed/au-demo-seed.ts):
 * a single club, inserted as a clubs row, with club_id stamped on every child
 * record, so the seed can run against a multi-tenant database without touching
 * another club's data. It creates:
 * - Club with country GB, currency GBP, timezone Europe/London, locale en-GB
 *   and British Gymnastics as the governing body
 * - A wide recreational base (pre-school, mixed recreational, boys',
 *   trampoline, adult) and a narrow competitive pathway (Women's Artistic
 *   development squad, TeamGym squad), carrying squad type, level, discipline
 *   and programme flags
 * - Families with Charnwood addresses, members with BG membership numbers and
 *   disciplines
 * - GBP fee structures, invoices, invoice items and payments
 * - Sessions in the gym with attendance history
 * - Bacs direct debit mandates
 * - DBS, PVG and AccessNI records, a Welfare Officer and consent records
 * - The award schemes the awards module ships (British Gymnastics Rise and the
 *   legacy Proficiency Awards) installed as ordinary rows, with per-member
 *   progress, two assessment events and badge fees billed through finance
 *
 * The times and strokes competitions module is feature-flagged off for this
 * product, so nothing here seeds it.
 *
 * DANGER: never run this against production. The repository root .env points
 * at the PRODUCTION database; always supply DB_* variables for a local
 * database explicitly. See docs/demos/gym-demo-club.md for safe usage.
 */

const CLUB_SLUG = 'kestrel-vale-gymnastics';
const CLUB_DOMAIN = 'kestrelvalegym.org.uk';
const LOCATION = 'Kestrel Vale Gymnastics Centre';
const DEMO_PASSWORD = 'Demo2024!';

const LOCAL_DB_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

/**
 * The database host the app config will actually connect to, or null when it
 * cannot be worked out.
 */
function resolveDbHost(): string | null {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
  const host = process.env.DB_HOST?.trim();
  return host ? host : null;
}

/**
 * Refuses to run against anything but a local database.
 *
 * NODE_ENV is not set in an ordinary shell, so checking it alone would let a
 * plain `pnpm seed:demo:gym` reach whatever the repository root .env points
 * at. Seeding a deployed database is a decision someone makes on purpose, so
 * it takes the same explicit SEED_DEMO_CLUB=true flag the container
 * entrypoint uses.
 */
function assertSafeTarget(): void {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run the gymnastics demo seed with NODE_ENV=production.');
    process.exit(1);
  }

  if (process.env.SEED_DEMO_CLUB === 'true') {
    return;
  }

  const host = resolveDbHost();
  if (host === null) {
    console.error(
      'Refusing to seed: no DATABASE_URL or DB_HOST is set, so the target database is unknown.\n' +
        'Pass DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD and DB_DATABASE for a local database.',
    );
    process.exit(1);
  }

  if (!LOCAL_DB_HOSTS.includes(host)) {
    console.error(
      `Refusing to seed the database at "${host}": it is not local.\n` +
        'The repository root .env points at a deployed database, so pass DB_* for a local one.\n' +
        'To seed a deployment on purpose, set SEED_DEMO_CLUB=true.',
    );
    process.exit(1);
  }
}

/** Round to 2 decimal places, matching InvoicesService.recalculateTotals. */
function roundTo2dp(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Nearest past occurrence of a weekday (0=Sun..6=Sat) relative to anchor. */
function prevWeekday(anchor: Date, dayOfWeek: number): Date {
  const d = new Date(anchor);
  const diff = (d.getDay() - dayOfWeek + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function monthsBefore(anchor: Date, months: number): Date {
  const d = new Date(anchor);
  d.setMonth(d.getMonth() - months);
  return d;
}

function daysBefore(anchor: Date, days: number): Date {
  const d = new Date(anchor);
  d.setDate(d.getDate() - days);
  return d;
}

// Deterministic attendance status: roughly 85% present, 8% absent, 7% late.
function attendanceStatus(memberIdx: number, sessionIdx: number): string {
  const n = (memberIdx * 17 + sessionIdx * 7) % 100;
  if (n < 85) return 'present';
  if (n < 93) return 'absent';
  return 'late';
}

/**
 * Which Rise journey a squad's gymnasts work through. Recreational classes run
 * Explore, pre-school runs Discover, the competitive squads run Excel, and the
 * adult class runs no award scheme at all: Rise is a children's programme and
 * pretending otherwise would make the demo lie.
 */
const RISE_JOURNEY_BY_SQUAD: Record<string, 'Discover' | 'Explore' | 'Excel' | null> = {
  tots: 'Discover',
  rec_a: 'Explore',
  rec_b: 'Explore',
  boys: 'Explore',
  tramp: 'Explore',
  wag: 'Excel',
  teamgym: 'Excel',
  adult: null,
};

/** The level each journey holds its demo assessment event for. */
const ASSESSMENT_LEVEL_BY_JOURNEY: Record<string, string> = {
  Discover: 'Discover 2',
  Explore: 'Explore 3',
  Excel: 'Excel 1',
};

/**
 * Every club-scoped table the seed clears before rebuilding, ordered child
 * before parent so a foreign key never blocks a delete. The four tables
 * deleted after this list (members, squads, users, families) are parents of
 * several entries here and are handled separately, along with squad_members,
 * which is scoped through its squad rather than by a club_id column.
 *
 * The list has to be complete, not just cover what this seed writes: an API
 * call made against the demo club between two seed runs can leave rows
 * behind, and one orphan is enough to make the final delete of the club fail.
 * assertClearOrderIsComplete checks it against the live schema.
 */
const CLUB_SCOPED_TABLES_CHILD_FIRST = [
  'attendance',
  'award_assessment_outcomes',
  'award_assessment_events',
  'member_award_progress',
  'award_levels',
  'award_schemes',
  'competition_results',
  'competition_entries',
  'competitions',
  'personal_bests',
  'payments',
  'invoice_items',
  'invoices',
  'direct_debit_mandates',
  'consents',
  'dbs_checks',
  'safeguarding_incidents',
  'safeguarding_checklist_items',
  'safeguarding_officers',
  'member_cycle_logs',
  'member_wellbeing_logs',
  'communications',
  'family_invites',
  'waitlist',
  'sessions',
  'fee_structures',
  'club_payment_connections',
  'club_settings',
  'audit_logs',
];

/** Tables cleared after the list above, in this order. */
const CLUB_SCOPED_TABLES_LAST = ['members', 'squads', 'users', 'families'];

/**
 * Fails loudly when a migration has added a club-scoped table the clear step
 * does not know about. Without this the seed would appear to work and then
 * fail on its second run with a foreign key violation, which is a slow and
 * confusing way to learn that a table is missing from the list.
 */
async function assertClearOrderIsComplete(dataSource: DataSource): Promise<void> {
  const rows: { table_name: string }[] = await dataSource.query(
    `SELECT table_name FROM information_schema.columns
     WHERE column_name = 'club_id' AND table_schema = 'public'`,
  );
  const known = new Set([...CLUB_SCOPED_TABLES_CHILD_FIRST, ...CLUB_SCOPED_TABLES_LAST]);
  const unknown = rows.map((r) => r.table_name).filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `The seed does not know how to clear these club-scoped tables: ${unknown.join(', ')}. ` +
        'Add them to CLUB_SCOPED_TABLES_CHILD_FIRST in src/seed/gym-demo-seed.ts, child before parent.',
    );
  }
}

interface SeedMember {
  squadKey: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  familyIndex: number;
  /**
   * British Gymnastics publishes no membership number format (the number
   * doubles as a My BG username), so the demo deliberately mixes plain digits
   * with prefixed forms to prove the field accepts either.
   */
  bgNumber: string;
  discipline: Discipline | null;
  /**
   * How far up their Rise journey this gymnast has got. Levels below it are
   * awarded, this level is assessed and awaiting sign-off, and the next one is
   * being worked towards.
   */
  riseStage: number;
  medicalNotes?: string;
  emergencyContact?: string;
}

async function seedGymDemoData() {
  console.log('Starting Kestrel Vale Gymnastics Club demo seed...\n');

  assertSafeTarget();

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // Clear any previous run of this seed, scoped to the Kestrel Vale club so
    // other tenants are untouched.
    console.log('Clearing any existing Kestrel Vale data...');
    const existing = await dataSource.query('SELECT id FROM clubs WHERE slug = $1', [CLUB_SLUG]);
    if (existing.length > 0) {
      const oldClubId = existing[0].id;
      await assertClearOrderIsComplete(dataSource);

      for (const table of CLUB_SCOPED_TABLES_CHILD_FIRST) {
        await dataSource.query(`DELETE FROM ${table} WHERE club_id = $1`, [oldClubId]);
      }
      // squad_members is the one club-scoped table without a club_id of its
      // own, so it is reached through its squads.
      await dataSource.query(
        'DELETE FROM squad_members WHERE squad_id IN (SELECT squad_id FROM squads WHERE club_id = $1)',
        [oldClubId],
      );
      for (const table of CLUB_SCOPED_TABLES_LAST) {
        await dataSource.query(`DELETE FROM ${table} WHERE club_id = $1`, [oldClubId]);
      }
      await dataSource.query('DELETE FROM clubs WHERE id = $1', [oldClubId]);
      console.log('Previous Kestrel Vale data removed\n');
    } else {
      console.log('No existing Kestrel Vale club found, nothing to clear\n');
    }

    // Club: British Gymnastics affiliated, England, GBP, Europe/London.
    //
    // Tax: most British Gymnastics clubs are non-profit and their coaching is
    // VAT exempt, so the demo bills no VAT. The fields are still populated
    // rather than left empty, with a zero rate, so the settings screens and
    // invoice totals show what a VAT-registered club would see.
    console.log('Creating Kestrel Vale Gymnastics Club...');
    const clubResult = await dataSource.query(
      `
      INSERT INTO clubs (
        name, slug, contact_email, phone, website,
        country, currency, timezone, locale,
        governing_body, governing_body_region, affiliation_number, county,
        tax_label, tax_rate, tax_inclusive,
        status
      )
      VALUES (
        'Kestrel Vale Gymnastics Club', $1,
        $2, '01509 496 210', $3,
        'GB', 'GBP', 'Europe/London', 'en-GB',
        'BRITISH_GYMNASTICS', 'England', 'BG-15342', 'Leicestershire',
        'VAT', 0.00, false,
        'active'
      )
      RETURNING id
    `,
      [CLUB_SLUG, `office@${CLUB_DOMAIN}`, `https://www.${CLUB_DOMAIN}`],
    );
    const clubId = clubResult[0].id;
    console.log(`Club created (ID: ${clubId})\n`);

    // Staff users. All demo users share the password Demo2024!.
    console.log('Creating staff users...');
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

    const staffUsers = [
      [`admin@${CLUB_DOMAIN}`, 'Helen', 'Whitcombe', 'super_admin'],
      [`rachel.oduya@${CLUB_DOMAIN}`, 'Rachel', 'Oduya', 'head_coach'],
      [`tom.beresford@${CLUB_DOMAIN}`, 'Tom', 'Beresford', 'squad_coach'],
      [`gemma.laird@${CLUB_DOMAIN}`, 'Gemma', 'Laird', 'welfare_officer'],
      [`david.pryce@${CLUB_DOMAIN}`, 'David', 'Pryce', 'treasurer'],
    ];
    const staffUserIds: string[] = [];
    for (const [email, firstName, lastName, role] of staffUsers) {
      const result = await dataSource.query(
        `INSERT INTO users (club_id, email, password_hash, first_name, last_name, role, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING user_id`,
        [clubId, email, hashedPassword, firstName, lastName, role],
      );
      staffUserIds.push(result[0].user_id);
    }
    const headCoachUserId = staffUserIds[1];
    console.log(`Created ${staffUserIds.length} staff users\n`);

    // Families around Charnwood in Leicestershire. Phone numbers use the Ofcom
    // 07700 900xxx range reserved for fiction.
    console.log('Creating families...');
    const familyData = [
      {
        name: 'Ashworth Family',
        contact: 'Claire Ashworth',
        email: 'claire.ashworth@example.com',
        phone: '07700 900101',
        address1: '14 Forest Road',
        city: 'Loughborough',
        postcode: 'LE11 3NW',
      },
      {
        name: 'Bhandari Family',
        contact: 'Anita Bhandari',
        email: 'anita.bhandari@example.com',
        phone: '07700 900102',
        address1: '32 Meadow Lane',
        city: 'Quorn',
        postcode: 'LE12 8AT',
      },
      {
        name: 'Okonkwo Family',
        contact: 'Chidi Okonkwo',
        email: 'chidi.okonkwo@example.com',
        phone: '07700 900103',
        address1: '5 Braddon Road',
        city: 'Loughborough',
        postcode: 'LE11 4RH',
      },
      {
        name: 'Fairhurst Family',
        contact: 'Steve Fairhurst',
        email: 'steve.fairhurst@example.com',
        phone: '07700 900104',
        address1: '71 Leicester Road',
        city: 'Shepshed',
        postcode: 'LE12 9DF',
      },
      {
        name: 'Novak Family',
        contact: 'Petra Novak',
        email: 'petra.novak@example.com',
        phone: '07700 900105',
        address1: '9 Bridge Street',
        city: 'Barrow upon Soar',
        postcode: 'LE12 8PN',
      },
      {
        name: 'Whitfield Family',
        contact: 'Laura Whitfield',
        email: 'laura.whitfield@example.com',
        phone: '07700 900106',
        address1: '18 Park Road',
        city: 'Birstall',
        postcode: 'LE4 3AN',
      },
      {
        name: 'Ramsay Family',
        contact: 'Iain Ramsay',
        email: 'iain.ramsay@example.com',
        phone: '07700 900107',
        address1: '44 Alan Moss Road',
        city: 'Loughborough',
        postcode: 'LE11 4RL',
      },
      {
        name: 'Tavares Family',
        contact: 'Sofia Tavares',
        email: 'sofia.tavares@example.com',
        phone: '07700 900108',
        address1: '2 Church Gate',
        city: 'Sileby',
        postcode: 'LE12 7NF',
      },
    ];

    const familyIds: string[] = [];
    for (const f of familyData) {
      const result = await dataSource.query(
        `INSERT INTO families (
           club_id, family_name, primary_contact_name, primary_contact_email,
           primary_contact_phone, address_line1, city, postcode
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING family_id`,
        [clubId, f.name, f.contact, f.email, f.phone, f.address1, f.city, f.postcode],
      );
      familyIds.push(result[0].family_id);
    }
    console.log(`Created ${familyIds.length} families\n`);

    // Parent users, one per family.
    console.log('Creating parent users...');
    const parentUserIds: string[] = [];
    for (let i = 0; i < familyData.length; i++) {
      const f = familyData[i];
      const nameParts = f.contact.split(' ');
      const result = await dataSource.query(
        `INSERT INTO users (club_id, email, password_hash, first_name, last_name, role, active, family_id)
         VALUES ($1, $2, $3, $4, $5, 'parent', true, $6)
         RETURNING user_id`,
        [clubId, f.email, hashedPassword, nameParts[0], nameParts.slice(1).join(' '), familyIds[i]],
      );
      parentUserIds.push(result[0].user_id);
    }
    console.log(`Created ${parentUserIds.length} parent users\n`);

    // Squads: a wide recreational base and a narrow competitive pathway, which
    // is the shape of nearly every British Gymnastics club. Recreational
    // classes carry a level label; competitive squads do not. Discipline is a
    // filtering attribute only, never a separate code path.
    console.log('Creating squads...');
    const squadData = [
      {
        key: 'tots',
        name: 'Tumble Tots',
        description:
          'Pre-school gymnastics for walkers up to school age, with a parent or carer on the floor. Shapes, rolls, balance and the first Rise Discover steps.',
        minAge: 2,
        maxAge: 4,
        coach: 'Tom Beresford',
        times: 'Wed 09:30-10:15, Sat 09:00-09:45',
        capacity: 16,
        squadType: SquadType.RECREATIONAL,
        level: 'Rise Discover',
        discipline: null as Discipline | null,
        programmeFlags: [ProgrammeFlag.PRE_SCHOOL],
      },
      {
        key: 'rec_a',
        name: 'Recreational Gymnastics: Explore Group A',
        description:
          'Weekly recreational class for gymnasts new to the floor and vault, working through the early Rise Explore stages.',
        minAge: 5,
        maxAge: 8,
        coach: 'Tom Beresford',
        times: 'Mon 16:00-17:00, Thu 16:00-17:00',
        capacity: 24,
        squadType: SquadType.RECREATIONAL,
        level: 'Rise Explore 1-2',
        discipline: Discipline.WOMENS_ARTISTIC,
        programmeFlags: [] as ProgrammeFlag[],
      },
      {
        key: 'rec_b',
        name: 'Recreational Gymnastics: Explore Group B',
        description:
          'Recreational class for gymnasts who have their basics, adding bar work, beam and the middle Rise Explore stages.',
        minAge: 8,
        maxAge: 12,
        coach: 'Rachel Oduya',
        times: 'Mon 17:00-18:15, Thu 17:00-18:15',
        capacity: 24,
        squadType: SquadType.RECREATIONAL,
        level: 'Rise Explore 3-5',
        discipline: Discipline.WOMENS_ARTISTIC,
        programmeFlags: [] as ProgrammeFlag[],
      },
      {
        key: 'boys',
        name: "Boys' Recreational Gymnastics",
        description:
          "Recreational class on the men's apparatus: floor, vault, rings, parallel bars and pommel work scaled to age.",
        minAge: 5,
        maxAge: 11,
        coach: 'Tom Beresford',
        times: 'Tue 16:30-17:45',
        capacity: 20,
        squadType: SquadType.RECREATIONAL,
        level: 'Rise Explore 1-3',
        discipline: Discipline.MENS_ARTISTIC,
        programmeFlags: [] as ProgrammeFlag[],
      },
      {
        key: 'tramp',
        name: 'Trampoline Recreational',
        description:
          'Trampoline class covering shape, height and the first somersaults, with a route into the county trampoline programme.',
        minAge: 7,
        maxAge: 14,
        coach: 'Rachel Oduya',
        times: 'Fri 17:00-18:30',
        capacity: 18,
        squadType: SquadType.RECREATIONAL,
        level: 'Rise Explore 2-5',
        discipline: Discipline.TRAMPOLINE,
        programmeFlags: [] as ProgrammeFlag[],
      },
      {
        key: 'wag',
        name: "Women's Artistic Development Squad",
        description:
          "Competitive Women's Artistic pathway training four times a week, entering county and regional competition.",
        minAge: 8,
        maxAge: 16,
        coach: 'Rachel Oduya',
        times: 'Mon/Wed/Fri 18:15-20:45, Sun 09:00-12:00',
        capacity: 14,
        squadType: SquadType.COMPETITIVE,
        level: null as string | null,
        discipline: Discipline.WOMENS_ARTISTIC,
        programmeFlags: [] as ProgrammeFlag[],
      },
      {
        key: 'teamgym',
        name: 'TeamGym Squad',
        description:
          'Competitive TeamGym squad working tumble, trampette and floor as a team, entering regional and national rounds.',
        minAge: 10,
        maxAge: 18,
        coach: 'Rachel Oduya',
        times: 'Tue 18:00-20:00, Sat 10:00-12:30',
        capacity: 16,
        squadType: SquadType.COMPETITIVE,
        level: null as string | null,
        discipline: Discipline.TEAMGYM,
        programmeFlags: [] as ProgrammeFlag[],
      },
      {
        key: 'adult',
        name: 'Adult Gymnastics',
        description:
          'Drop-in class for adults, from complete beginners to returning gymnasts. No award scheme; members work to their own goals.',
        minAge: 18,
        maxAge: 99,
        coach: 'Tom Beresford',
        times: 'Wed 20:00-21:30',
        capacity: 20,
        squadType: SquadType.RECREATIONAL,
        level: null as string | null,
        discipline: null as Discipline | null,
        programmeFlags: [ProgrammeFlag.ADULT],
      },
    ];

    const squadIds: Record<string, string> = {};
    for (const s of squadData) {
      const result = await dataSource.query(
        `INSERT INTO squads (
           club_id, squad_name, description, min_age, max_age, coach_name, training_times,
           max_capacity, squad_type, level, discipline, programme_flags
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING squad_id`,
        [
          clubId,
          s.name,
          s.description,
          s.minAge,
          s.maxAge,
          s.coach,
          s.times,
          s.capacity,
          s.squadType,
          s.level,
          s.discipline,
          s.programmeFlags.length > 0 ? JSON.stringify(s.programmeFlags) : null,
        ],
      );
      squadIds[s.key] = result[0].squad_id;
    }
    console.log(`Created ${squadData.length} squads\n`);

    console.log('Creating members...');
    const memberData: SeedMember[] = [
      {
        squadKey: 'rec_a',
        firstName: 'Maisie',
        lastName: 'Ashworth',
        dob: '2018-04-18',
        gender: 'F',
        familyIndex: 0,
        bgNumber: '2104517',
        discipline: Discipline.WOMENS_ARTISTIC,
        riseStage: 2,
        emergencyContact: 'Claire Ashworth (mother), 07700 900101',
      },
      {
        squadKey: 'wag',
        firstName: 'Freya',
        lastName: 'Ashworth',
        dob: '2014-09-02',
        gender: 'F',
        familyIndex: 0,
        bgNumber: '2104518',
        discipline: Discipline.WOMENS_ARTISTIC,
        riseStage: 2,
        emergencyContact: 'Claire Ashworth (mother), 07700 900101',
      },
      {
        squadKey: 'tots',
        firstName: 'Aarav',
        lastName: 'Bhandari',
        dob: '2022-06-11',
        gender: 'M',
        familyIndex: 1,
        bgNumber: 'BG-3391204',
        discipline: null,
        riseStage: 2,
      },
      {
        squadKey: 'rec_b',
        firstName: 'Priya',
        lastName: 'Bhandari',
        dob: '2015-01-27',
        gender: 'F',
        familyIndex: 1,
        bgNumber: 'BG-3391205',
        discipline: Discipline.WOMENS_ARTISTIC,
        riseStage: 4,
        medicalNotes: 'Asthma. Blue inhaler kept in the coach bag on the balcony.',
      },
      {
        squadKey: 'boys',
        firstName: 'Emeka',
        lastName: 'Okonkwo',
        dob: '2016-11-05',
        gender: 'M',
        familyIndex: 2,
        bgNumber: '1188342',
        discipline: Discipline.MENS_ARTISTIC,
        riseStage: 3,
      },
      {
        squadKey: 'tots',
        firstName: 'Ada',
        lastName: 'Okonkwo',
        dob: '2021-08-22',
        gender: 'F',
        familyIndex: 2,
        bgNumber: '1188343',
        discipline: null,
        riseStage: 1,
      },
      {
        squadKey: 'tramp',
        firstName: 'Jonah',
        lastName: 'Fairhurst',
        dob: '2013-03-14',
        gender: 'M',
        familyIndex: 3,
        bgNumber: '4470021',
        discipline: Discipline.TRAMPOLINE,
        riseStage: 5,
      },
      {
        squadKey: 'adult',
        firstName: 'Steve',
        lastName: 'Fairhurst',
        dob: '1985-09-12',
        gender: 'M',
        familyIndex: 3,
        bgNumber: '4470022',
        discipline: null,
        riseStage: 0,
      },
      {
        squadKey: 'rec_a',
        firstName: 'Emma',
        lastName: 'Novak',
        dob: '2017-07-30',
        gender: 'F',
        familyIndex: 4,
        bgNumber: 'BG7781',
        discipline: Discipline.WOMENS_ARTISTIC,
        riseStage: 1,
      },
      {
        squadKey: 'boys',
        firstName: 'Tomas',
        lastName: 'Novak',
        dob: '2015-05-09',
        gender: 'M',
        familyIndex: 4,
        bgNumber: '2209914',
        discipline: Discipline.MENS_ARTISTIC,
        riseStage: 2,
        medicalNotes: 'Nut allergy. Carries an adrenaline auto-injector in his kit bag.',
      },
      {
        squadKey: 'wag',
        firstName: 'Isla',
        lastName: 'Whitfield',
        dob: '2013-12-01',
        gender: 'F',
        familyIndex: 5,
        bgNumber: '3310457',
        discipline: Discipline.WOMENS_ARTISTIC,
        riseStage: 1,
      },
      {
        squadKey: 'teamgym',
        firstName: 'Rowan',
        lastName: 'Whitfield',
        dob: '2011-02-19',
        gender: 'F',
        familyIndex: 5,
        bgNumber: '2209915',
        discipline: Discipline.TEAMGYM,
        riseStage: 1,
      },
      {
        squadKey: 'tramp',
        firstName: 'Callum',
        lastName: 'Ramsay',
        dob: '2014-06-25',
        gender: 'M',
        familyIndex: 6,
        bgNumber: '5560012',
        discipline: Discipline.TRAMPOLINE,
        riseStage: 3,
      },
      {
        squadKey: 'rec_b',
        firstName: 'Eilidh',
        lastName: 'Ramsay',
        dob: '2016-10-08',
        gender: 'F',
        familyIndex: 6,
        bgNumber: '5560013',
        discipline: Discipline.WOMENS_ARTISTIC,
        riseStage: 4,
      },
      {
        squadKey: 'boys',
        firstName: 'Mateus',
        lastName: 'Tavares',
        dob: '2017-01-16',
        gender: 'M',
        familyIndex: 7,
        bgNumber: '9001234',
        discipline: Discipline.MENS_ARTISTIC,
        riseStage: 2,
      },
      {
        squadKey: 'teamgym',
        firstName: 'Beatriz',
        lastName: 'Tavares',
        dob: '2012-04-03',
        gender: 'F',
        familyIndex: 7,
        bgNumber: 'BG-3391206',
        discipline: Discipline.TEAMGYM,
        riseStage: 2,
      },
    ];

    const memberIds: string[] = [];
    for (const m of memberData) {
      const result = await dataSource.query(
        `INSERT INTO members (
           club_id, family_id, registration_number, governing_body, first_name, last_name,
           dob, gender, squad_id, discipline, medical_notes, emergency_contact
         )
         VALUES ($1, $2, $3, 'BRITISH_GYMNASTICS', $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING member_id`,
        [
          clubId,
          familyIds[m.familyIndex],
          m.bgNumber,
          m.firstName,
          m.lastName,
          m.dob,
          m.gender,
          squadIds[m.squadKey],
          m.discipline,
          m.medicalNotes ?? null,
          m.emergencyContact ?? null,
        ],
      );
      const memberId = result[0].member_id;
      memberIds.push(memberId);
      await dataSource.query('INSERT INTO squad_members (squad_id, member_id) VALUES ($1, $2)', [
        squadIds[m.squadKey],
        memberId,
      ]);
    }
    console.log(`Created ${memberIds.length} members\n`);

    // Fee structures in GBP. Recreational classes bill per term, which is how
    // most gym clubs price them; the competitive squads bill monthly on the
    // Direct Debit cycle. The badge fee is a one-off charge raised when a Rise
    // level is awarded.
    console.log('Creating fee structures...');
    const squadFeeByKey: Record<string, { amount: number; frequency: string }> = {
      tots: { amount: 68.0, frequency: 'term' },
      rec_a: { amount: 82.0, frequency: 'term' },
      rec_b: { amount: 96.0, frequency: 'term' },
      boys: { amount: 88.0, frequency: 'term' },
      tramp: { amount: 92.0, frequency: 'term' },
      wag: { amount: 78.0, frequency: 'monthly' },
      teamgym: { amount: 62.0, frequency: 'monthly' },
      adult: { amount: 45.0, frequency: 'term' },
    };

    interface FeeDef {
      key: string;
      name: string;
      description: string;
      amount: number;
      frequency: string;
      appliesToType: string;
      appliesToId: () => string | null;
    }

    const feeDefs: FeeDef[] = squadData.map((s) => ({
      key: s.key,
      name: `${s.name} Fee`,
      description:
        squadFeeByKey[s.key].frequency === 'term'
          ? `Per-term fee for ${s.name}.`
          : `Monthly training fee for ${s.name}.`,
      amount: squadFeeByKey[s.key].amount,
      frequency: squadFeeByKey[s.key].frequency,
      appliesToType: 'squad',
      appliesToId: () => squadIds[s.key],
    }));

    feeDefs.push({
      key: 'club',
      name: 'Annual Club Membership',
      description:
        'Kestrel Vale annual club membership. Separate from the British Gymnastics membership a gymnast holds through My BG.',
      amount: 32.0,
      frequency: 'annual',
      appliesToType: 'club',
      appliesToId: () => null,
    });
    feeDefs.push({
      key: 'badge',
      name: 'Rise Badge and Certificate',
      description: 'Badge and certificate charged when a Rise level is awarded.',
      amount: 5.0,
      frequency: 'one_time',
      appliesToType: 'club',
      appliesToId: () => null,
    });

    const feeIds: Record<string, string> = {};
    for (const f of feeDefs) {
      const result = await dataSource.query(
        `INSERT INTO fee_structures (club_id, name, description, amount, currency, frequency, applies_to_type, applies_to_id, active)
         VALUES ($1, $2, $3, $4, 'GBP', $5, $6, $7, true)
         RETURNING fee_structure_id`,
        [clubId, f.name, f.description, f.amount, f.frequency, f.appliesToType, f.appliesToId()],
      );
      feeIds[f.key] = result[0].fee_structure_id;
    }
    console.log(`Created ${feeDefs.length} fee structures\n`);

    // Award schemes. These are the fixtures the awards module ships, written
    // in as ordinary rows: British Gymnastics Rise, and the legacy Proficiency
    // Awards a club part-way through the transition still needs. Nothing here
    // is special-cased; the club can rename, reprice or delete any of it.
    console.log('Installing award schemes...');
    const BADGE_FEE = 3.5;
    const CERTIFICATE_FEE = 1.5;
    const riseLevelIds: Record<string, string> = {};
    let schemeCount = 0;
    let levelCount = 0;

    for (const scheme of DEFAULT_AWARD_SCHEMES) {
      const schemeResult = await dataSource.query(
        `INSERT INTO award_schemes (club_id, name, description, source, active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING scheme_id`,
        [clubId, scheme.name, scheme.description, scheme.source],
      );
      const schemeId = schemeResult[0].scheme_id;
      schemeCount++;

      const isRise = scheme.source === AwardSchemeSource.BG_RISE;
      for (const level of scheme.levels) {
        const levelResult = await dataSource.query(
          `INSERT INTO award_levels (
             club_id, scheme_id, name, description, sort_order,
             badge_fee, certificate_fee, fee_structure_id, active
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING level_id`,
          [
            clubId,
            schemeId,
            level.name,
            level.description,
            level.sort_order,
            isRise ? BADGE_FEE : null,
            isRise ? CERTIFICATE_FEE : null,
            isRise ? feeIds['badge'] : null,
            // The club has moved to Rise, so the legacy scheme is installed
            // for its history but switched off for new assessments.
            isRise,
          ],
        );
        levelCount++;
        if (isRise) {
          riseLevelIds[level.name] = levelResult[0].level_id;
        }
      }
    }
    console.log(`Installed ${schemeCount} award schemes with ${levelCount} levels\n`);

    // Per-member Rise progress. Everything below a gymnast's stage is awarded,
    // the stage itself is assessed and waiting on sign-off, and the next level
    // is being worked towards.
    console.log('Creating award progress...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    interface ProgressRow {
      progressId: string;
      memberIdx: number;
      levelName: string;
      status: AwardProgressStatus;
    }
    const progressRows: ProgressRow[] = [];

    for (let i = 0; i < memberData.length; i++) {
      const m = memberData[i];
      const journey = RISE_JOURNEY_BY_SQUAD[m.squadKey];
      if (!journey || m.riseStage < 1) continue;

      for (let step = 1; step <= m.riseStage + 1; step++) {
        const levelName = `${journey} ${step}`;
        const levelId = riseLevelIds[levelName];
        // The journeys are finite, so a gymnast near the top has no next level.
        if (!levelId) continue;

        let status: AwardProgressStatus;
        let startedOn: string | null;
        let assessedOn: string | null = null;
        let awardedOn: string | null = null;

        if (step < m.riseStage) {
          status = AwardProgressStatus.AWARDED;
          const monthsAgo = (m.riseStage - step) * 4;
          startedOn = formatDate(monthsBefore(today, monthsAgo + 3));
          assessedOn = formatDate(monthsBefore(today, monthsAgo));
          awardedOn = assessedOn;
        } else if (step === m.riseStage) {
          status = AwardProgressStatus.ASSESSED;
          startedOn = formatDate(monthsBefore(today, 4));
          assessedOn = formatDate(daysBefore(today, 21));
        } else {
          status = AwardProgressStatus.WORKING_TOWARDS;
          startedOn = formatDate(daysBefore(today, 14));
        }

        const result = await dataSource.query(
          `INSERT INTO member_award_progress (
             club_id, member_id, level_id, status, started_on, assessed_on, awarded_on, notes
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING progress_id`,
          [
            clubId,
            memberIds[i],
            levelId,
            status,
            startedOn,
            assessedOn,
            awardedOn,
            status === AwardProgressStatus.WORKING_TOWARDS
              ? `Working towards ${levelName} in ${squadData.find((s) => s.key === m.squadKey)?.name}.`
              : null,
          ],
        );
        progressRows.push({
          progressId: result[0].progress_id,
          memberIdx: i,
          levelName,
          status,
        });
      }
    }
    console.log(`Created ${progressRows.length} award progress records\n`);

    // Assessment events: one badge day per journey, three weeks ago, recorded
    // by the head coach. Gymnasts who already hold the level were awarded it
    // then; the ones sitting at that level were seen but not yet signed off.
    console.log('Creating assessment events...');
    const assessmentDate = formatDate(daysBefore(today, 21));
    let eventCount = 0;
    let outcomeCount = 0;

    for (const [journey, levelName] of Object.entries(ASSESSMENT_LEVEL_BY_JOURNEY)) {
      const levelId = riseLevelIds[levelName];
      const attendees = progressRows.filter(
        (p) =>
          p.levelName === levelName &&
          (p.status === AwardProgressStatus.AWARDED || p.status === AwardProgressStatus.ASSESSED),
      );
      if (!levelId || attendees.length === 0) continue;

      const eventResult = await dataSource.query(
        `INSERT INTO award_assessment_events (club_id, level_id, assessed_at, assessed_by_user_id, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING event_id`,
        [
          clubId,
          levelId,
          assessmentDate,
          headCoachUserId,
          `Rise ${journey} badge day, ${levelName}.`,
        ],
      );
      const eventId = eventResult[0].event_id;
      eventCount++;

      for (const attendee of attendees) {
        await dataSource.query(
          `INSERT INTO award_assessment_outcomes (club_id, event_id, member_id, outcome, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            clubId,
            eventId,
            memberIds[attendee.memberIdx],
            attendee.status === AwardProgressStatus.AWARDED
              ? AssessmentOutcomeResult.AWARDED
              : AssessmentOutcomeResult.NOT_YET,
            attendee.status === AwardProgressStatus.AWARDED
              ? null
              : 'Two elements to revisit before sign-off.',
          ],
        );
        outcomeCount++;
      }
    }
    console.log(`Created ${eventCount} assessment events and ${outcomeCount} outcomes\n`);

    // Sessions in the gym. Times are club-local (Europe/London): after-school
    // recreational classes, weekday-evening squad training and weekend blocks.
    // The past four weeks are completed, the next two are scheduled.
    console.log('Creating sessions...');
    // squadKey, dayOfWeek (0=Sun..6=Sat), startTime, endTime, sessionName, coach
    const sessionTemplates: [string, number, string, string, string, string][] = [
      ['tots', 3, '09:30', '10:15', 'Tumble Tots - Wednesday Morning', 'Tom Beresford'],
      ['tots', 6, '09:00', '09:45', 'Tumble Tots - Saturday Morning', 'Tom Beresford'],
      ['rec_a', 1, '16:00', '17:00', 'Explore Group A - Monday', 'Tom Beresford'],
      ['rec_a', 4, '16:00', '17:00', 'Explore Group A - Thursday', 'Tom Beresford'],
      ['rec_b', 1, '17:00', '18:15', 'Explore Group B - Monday', 'Rachel Oduya'],
      ['rec_b', 4, '17:00', '18:15', 'Explore Group B - Thursday', 'Rachel Oduya'],
      ['boys', 2, '16:30', '17:45', "Boys' Recreational - Tuesday", 'Tom Beresford'],
      ['tramp', 5, '17:00', '18:30', 'Trampoline Recreational - Friday', 'Rachel Oduya'],
      ['wag', 1, '18:15', '20:45', 'WAG Development Squad - Monday', 'Rachel Oduya'],
      ['wag', 3, '18:15', '20:45', 'WAG Development Squad - Wednesday', 'Rachel Oduya'],
      ['wag', 5, '18:15', '20:45', 'WAG Development Squad - Friday', 'Rachel Oduya'],
      ['wag', 0, '09:00', '12:00', 'WAG Development Squad - Sunday', 'Rachel Oduya'],
      ['teamgym', 2, '18:00', '20:00', 'TeamGym Squad - Tuesday', 'Rachel Oduya'],
      ['teamgym', 6, '10:00', '12:30', 'TeamGym Squad - Saturday', 'Rachel Oduya'],
      ['adult', 3, '20:00', '21:30', 'Adult Gymnastics - Wednesday', 'Tom Beresford'],
    ];

    const weekOffsets = [-4, -3, -2, -1, 1, 2];
    const completedSessionsBySquad: Record<string, { sessionId: string; sessionIdx: number }[]> =
      {};
    for (const s of squadData) {
      completedSessionsBySquad[s.key] = [];
    }
    let sessionCount = 0;
    let globalSessionIdx = 0;

    for (const weekOffset of weekOffsets) {
      const isPast = weekOffset < 0;
      const status = isPast ? 'completed' : 'scheduled';
      const monday = prevWeekday(today, 1);
      monday.setDate(monday.getDate() + weekOffset * 7);

      for (const [
        squadKey,
        dayOfWeek,
        startTime,
        endTime,
        sessionName,
        coach,
      ] of sessionTemplates) {
        const daysFromMon = (dayOfWeek + 6) % 7;
        const sessionDate = new Date(monday);
        sessionDate.setDate(monday.getDate() + daysFromMon);

        const result = await dataSource.query(
          `INSERT INTO sessions (club_id, squad_id, session_name, session_date, start_time, end_time, location, coach_name, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING session_id`,
          [
            clubId,
            squadIds[squadKey],
            sessionName,
            formatDate(sessionDate),
            startTime,
            endTime,
            LOCATION,
            coach,
            status,
          ],
        );
        sessionCount++;
        if (isPast) {
          completedSessionsBySquad[squadKey].push({
            sessionId: result[0].session_id,
            sessionIdx: globalSessionIdx,
          });
        }
        globalSessionIdx++;
      }
    }
    console.log(`Created ${sessionCount} sessions\n`);

    // Attendance for completed sessions, deterministic so re-runs are stable.
    console.log('Creating attendance records...');
    const squadMemberIdx: Record<string, number[]> = {};
    for (const s of squadData) {
      squadMemberIdx[s.key] = [];
    }
    memberData.forEach((m, idx) => squadMemberIdx[m.squadKey].push(idx));

    let attendanceCount = 0;
    for (const s of squadData) {
      for (const { sessionId, sessionIdx } of completedSessionsBySquad[s.key]) {
        for (const memberIdx of squadMemberIdx[s.key]) {
          const status = attendanceStatus(memberIdx, sessionIdx);
          await dataSource.query(
            `INSERT INTO attendance (club_id, session_id, member_id, status, checked_in_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              clubId,
              sessionId,
              memberIds[memberIdx],
              status,
              status === 'absent' ? null : new Date().toISOString(),
            ],
          );
          attendanceCount++;
        }
      }
    }
    console.log(`Created ${attendanceCount} attendance records\n`);

    // Invoices in GBP, one per family for the current billing month. The club
    // is not VAT registered, so the line-item sum is the total and the tax
    // amount is zero. Where a gymnast's most recent Rise level was awarded
    // this month the badge and certificate are billed on the same invoice,
    // which is the route every award fee takes.
    console.log('Creating invoices...');
    const invoiceStatuses = [
      'paid',
      'paid',
      'pending',
      'paid',
      'overdue',
      'pending',
      'paid',
      'draft',
    ];
    const issuedDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const dueDate = new Date(issuedDate);
    dueDate.setDate(dueDate.getDate() + 14);
    const monthLabel = issuedDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    // One gymnast in four had a badge signed off this billing period.
    const badgeBilledMemberIdx = memberData
      .map((_unused, idx) => idx)
      .filter((idx) => idx % 4 === 0 && RISE_JOURNEY_BY_SQUAD[memberData[idx].squadKey] !== null);

    let invoiceCount = 0;
    let paymentCount = 0;
    let badgeLineCount = 0;

    for (let famIdx = 0; famIdx < familyIds.length; famIdx++) {
      const famMembers = memberData
        .map((m, idx) => ({ m, idx }))
        .filter(({ m }) => m.familyIndex === famIdx);
      if (famMembers.length === 0) continue;

      interface InvoiceLine {
        description: string;
        amount: number;
        feeKey: string;
        /** Set when this line is a badge charge, so progress can point at it. */
        progressId?: string;
      }
      const lines: InvoiceLine[] = [];

      for (const { m, idx } of famMembers) {
        const squadName = squadData.find((s) => s.key === m.squadKey)?.name ?? m.squadKey;
        const fee = squadFeeByKey[m.squadKey];
        lines.push({
          description: `${squadName} ${fee.frequency === 'term' ? 'term' : 'monthly'} fee - ${m.firstName} ${m.lastName} (${monthLabel})`,
          amount: fee.amount,
          feeKey: m.squadKey,
        });

        if (!badgeBilledMemberIdx.includes(idx)) continue;
        const awarded = progressRows
          .filter((p) => p.memberIdx === idx && p.status === AwardProgressStatus.AWARDED)
          .pop();
        if (!awarded) continue;
        lines.push({
          description: `Rise ${awarded.levelName} badge and certificate - ${m.firstName} ${m.lastName}`,
          amount: roundTo2dp(BADGE_FEE + CERTIFICATE_FEE),
          feeKey: 'badge',
          progressId: awarded.progressId,
        });
      }

      const total = roundTo2dp(lines.reduce((sum, line) => sum + line.amount, 0));
      const status = invoiceStatuses[famIdx];
      const invoiceNumber = `KVGC-${issuedDate.getFullYear()}-${String(famIdx + 1).padStart(3, '0')}`;

      const invoiceResult = await dataSource.query(
        `INSERT INTO invoices (club_id, family_id, invoice_number, subtotal, tax_amount, total_amount, currency, issued_date, due_date, status)
         VALUES ($1, $2, $3, $4, 0, $5, 'GBP', $6, $7, $8)
         RETURNING invoice_id`,
        [
          clubId,
          familyIds[famIdx],
          invoiceNumber,
          total,
          total,
          formatDate(issuedDate),
          formatDate(dueDate),
          status,
        ],
      );
      const invoiceId = invoiceResult[0].invoice_id;

      for (const line of lines) {
        await dataSource.query(
          `INSERT INTO invoice_items (club_id, invoice_id, description, unit_price, quantity, total, fee_structure_id)
           VALUES ($1, $2, $3, $4, 1, $5, $6)`,
          [clubId, invoiceId, line.description, line.amount, line.amount, feeIds[line.feeKey]],
        );
        if (line.progressId) {
          await dataSource.query(
            'UPDATE member_award_progress SET invoice_id = $1 WHERE progress_id = $2',
            [invoiceId, line.progressId],
          );
          badgeLineCount++;
        }
      }

      if (status === 'paid') {
        await dataSource.query(
          `INSERT INTO payments (club_id, invoice_id, amount, currency, payment_date, payment_method, status, provider, reference_number)
           VALUES ($1, $2, $3, 'GBP', $4, 'direct_debit', 'confirmed', 'gocardless', $5)`,
          [clubId, invoiceId, total, formatDate(issuedDate), `PAY-${invoiceNumber}`],
        );
        paymentCount++;
      }
      invoiceCount++;
    }
    console.log(
      `Created ${invoiceCount} invoices (${badgeLineCount} with a badge charge) and ${paymentCount} payments\n`,
    );

    // Direct debit mandates on Bacs, the UK scheme. The provider mandate ids
    // are fabricated: this seed writes mandate rows directly rather than going
    // through GoCardless, which is the same demo path the AU seed uses.
    console.log('Creating Bacs direct debit mandates...');
    const mandateFamilies = 6;
    for (let i = 0; i < mandateFamilies; i++) {
      await dataSource.query(
        `INSERT INTO direct_debit_mandates (club_id, family_id, provider, provider_mandate_id, status, scheme)
         VALUES ($1, $2, 'gocardless', $3, $4, 'bacs')`,
        [
          clubId,
          familyIds[i],
          `MD-GB-${String(i + 1).padStart(6, '0')}`,
          i < mandateFamilies - 1 ? 'active' : 'pending',
        ],
      );
    }
    console.log(`Created ${mandateFamilies} mandates\n`);

    // Background checks. British Gymnastics clubs in England and Wales record
    // DBS checks; Scotland runs PVG and Northern Ireland AccessNI, and both
    // appear here because coaches move between home nations. Gemma's check is
    // inside the 90-day window so the compliance dashboard shows one expiring.
    // All certificate numbers are fictional.
    console.log('Creating background checks...');
    const backgroundChecks = [
      // user index, certificate, type, status, issue, expiry, notes
      [
        1,
        '001234567890',
        'ENHANCED_BARRED',
        'VALID',
        '2026-01-19',
        '2029-01-19',
        'Enhanced DBS with children barred list, held on the DBS Update Service.',
      ],
      [
        2,
        '001234567891',
        'ENHANCED_BARRED',
        'VALID',
        '2026-05-06',
        '2029-05-06',
        'Enhanced DBS with children barred list, checked by the Welfare Officer.',
      ],
      [
        3,
        '001234567892',
        'ENHANCED',
        'EXPIRING_SOON',
        '2023-10-02',
        '2026-10-02',
        'Enhanced DBS. Renewal started; reminder sent to the Welfare Officer.',
      ],
      [
        0,
        'PVG-4471209',
        'BACKGROUND_CHECK',
        'VALID',
        '2025-04-14',
        '2030-04-14',
        'PVG Scheme membership held from a previous club in Scotland.',
      ],
      [
        4,
        'ANI-88231044',
        'CRIMINAL_RECORD_CHECK',
        'VALID',
        '2026-03-11',
        '2029-03-11',
        'AccessNI enhanced check, held from coaching in Northern Ireland.',
      ],
    ] as const;
    for (const [
      userIdx,
      certificate,
      checkType,
      status,
      issue,
      expiry,
      notes,
    ] of backgroundChecks) {
      await dataSource.query(
        `INSERT INTO dbs_checks (club_id, user_id, certificate_number, check_type, status, issue_date, expiry_date, is_valid, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
        [clubId, staffUserIds[userIdx], certificate, checkType, status, issue, expiry, notes],
      );
    }
    console.log(`Created ${backgroundChecks.length} background checks\n`);

    // Safeguarding officer. British Gymnastics clubs appoint a Welfare
    // Officer, working to BG's Safeguarding and Protecting Children Policy.
    console.log('Creating safeguarding officer...');
    await dataSource.query(
      `INSERT INTO safeguarding_officers (club_id, name, role, email, phone, dbs_number, dbs_expiry, qualifications)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        clubId,
        'Gemma Laird',
        'Welfare Officer',
        `gemma.laird@${CLUB_DOMAIN}`,
        '07700 900109',
        '001234567892',
        '2026-10-02',
        'British Gymnastics Safeguarding and Protecting Children; Time to Listen (Welfare Officer) course.',
      ],
    );
    console.log('Created 1 safeguarding officer (Welfare Officer)\n');

    // Consents. Data sharing covers sharing member data with British
    // Gymnastics. Deterministic denials give the demo a realistic mix.
    console.log('Creating consent records...');
    let consentCount = 0;
    for (let i = 0; i < memberIds.length; i++) {
      const parentUserId = parentUserIds[memberData[i].familyIndex];
      const consents: [string, string][] = [
        ['MEDICAL_TREATMENT', 'GRANTED'],
        ['PHOTOGRAPHY', i % 5 === 4 ? 'DENIED' : 'GRANTED'],
        ['DATA_SHARING', i % 7 === 6 ? 'DENIED' : 'GRANTED'],
      ];
      for (const [consentType, status] of consents) {
        await dataSource.query(
          `INSERT INTO consents (club_id, member_id, consent_type, status, granted_by_user_id, granted_date)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            clubId,
            memberIds[i],
            consentType,
            status,
            parentUserId,
            formatDate(monthsBefore(today, 8)),
          ],
        );
        consentCount++;
      }
    }
    console.log(`Created ${consentCount} consent records\n`);

    console.log('Kestrel Vale Gymnastics Club demo seed complete\n');
    console.log('Summary:');
    console.log('  - 1 club (GB, GBP, Europe/London, en-GB, British Gymnastics, England)');
    console.log(`  - ${staffUserIds.length} staff users, ${parentUserIds.length} parent users`);
    console.log(`  - ${familyIds.length} families`);
    console.log(`  - ${memberIds.length} members`);
    console.log(`  - ${squadData.length} squads (recreational and competitive)`);
    console.log(`  - ${feeDefs.length} fee structures (GBP)`);
    console.log(`  - ${schemeCount} award schemes, ${levelCount} levels`);
    console.log(
      `  - ${progressRows.length} award progress records, ${eventCount} assessment events, ${outcomeCount} outcomes`,
    );
    console.log(`  - ${sessionCount} sessions at ${LOCATION}`);
    console.log(`  - ${attendanceCount} attendance records`);
    console.log(`  - ${invoiceCount} invoices, ${paymentCount} payments`);
    console.log(`  - ${mandateFamilies} Bacs direct debit mandates`);
    console.log(
      `  - ${backgroundChecks.length} background checks, 1 Welfare Officer, ${consentCount} consents`,
    );
    console.log(`\nDefault password for all users: ${DEMO_PASSWORD}`);
    console.log(`Admin login: admin@${CLUB_DOMAIN}`);
    console.log(`Parent login: ${familyData[0].email}\n`);
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seedGymDemoData()
  .then(() => {
    console.log('Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
