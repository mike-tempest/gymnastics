import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Demo seed script for Manly Sharks Swimming Club (Australian demo club).
 *
 * Mirrors the structure of the UK demo seed (src/seed/demo-seed.ts) but is
 * scoped to a single club so it can run against a multi-tenant database
 * without touching any other club's data. Creates comprehensive demo data
 * exercising the Australian feature set:
 * - Club with country AU, currency AUD, timezone Australia/Sydney, locale
 *   en-AU, Swimming Australia governing body (NSW region), GST-inclusive
 *   tax configuration and a fictional ABN
 * - Families with Northern Beaches (Sydney) addresses and AU mobile numbers
 * - Members with Swimming Australia style alphanumeric member numbers
 * - Squads, AUD fee structures and GST-inclusive invoices
 * - Sessions at Manly Aquatic Centre with attendance history
 * - Working With Children Check (NSW) compliance records, an MPIO
 *   safeguarding officer and consent records
 * - Competitions across the southern-hemisphere season (December to March)
 * - BECS direct debit mandates
 *
 * The ABN used (83 914 571 560) is fabricated: the digits satisfy the ABN
 * checksum so validation passes, but it does not belong to any real
 * organisation.
 *
 * DANGER: never run this against production. The repository root .env points
 * at the PRODUCTION database; always supply DB_* variables for a local
 * database explicitly. See docs/demos/au-demo-club.md for safe usage.
 */

const CLUB_SLUG = 'manly-sharks';

/** Round to 2 decimal places, matching InvoicesService.recalculateTotals. */
function roundTo2dp(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Back GST out of a gross (tax-inclusive) amount, matching the club-level
 * tax_inclusive convention used by InvoicesService: the line-item sum is the
 * gross total, tax = gross * rate / (100 + rate).
 */
function gstFromGross(gross: number, rate: number): { subtotal: number; tax: number } {
  const tax = roundTo2dp((gross * rate) / (100 + rate));
  return { subtotal: roundTo2dp(gross - tax), tax };
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

// Deterministic attendance status: roughly 85% present, 8% absent, 7% late.
function attendanceStatus(memberIdx: number, sessionIdx: number): string {
  const n = (memberIdx * 17 + sessionIdx * 7) % 100;
  if (n < 85) return 'present';
  if (n < 93) return 'absent';
  return 'late';
}

async function seedAuDemoData() {
  console.log('Starting Manly Sharks (AU) demo seed...\n');

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run the AU demo seed with NODE_ENV=production.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // Clear any previous run of this seed, scoped to the Manly Sharks club so
    // other tenants are untouched (unlike the UK seed's TRUNCATE approach,
    // which predates multi-tenancy).
    console.log('Clearing any existing Manly Sharks data...');
    const existing = await dataSource.query('SELECT id FROM clubs WHERE slug = $1', [CLUB_SLUG]);
    if (existing.length > 0) {
      const oldClubId = existing[0].id;
      const scopedTables = [
        'attendance',
        'payments',
        'invoice_items',
        'invoices',
        'direct_debit_mandates',
        'consents',
        'dbs_checks',
        'safeguarding_officers',
        'competition_results',
        'competition_entries',
        'competitions',
        'sessions',
        'fee_structures',
        'communications',
        'family_invites',
      ];
      for (const table of scopedTables) {
        await dataSource.query(`DELETE FROM ${table} WHERE club_id = $1`, [oldClubId]);
      }
      await dataSource.query(
        'DELETE FROM squad_members WHERE squad_id IN (SELECT squad_id FROM squads WHERE club_id = $1)',
        [oldClubId],
      );
      await dataSource.query('DELETE FROM members WHERE club_id = $1', [oldClubId]);
      await dataSource.query('DELETE FROM squads WHERE club_id = $1', [oldClubId]);
      await dataSource.query('DELETE FROM users WHERE club_id = $1', [oldClubId]);
      await dataSource.query('DELETE FROM families WHERE club_id = $1', [oldClubId]);
      await dataSource.query('DELETE FROM clubs WHERE id = $1', [oldClubId]);
      console.log('Previous Manly Sharks data removed\n');
    } else {
      console.log('No existing Manly Sharks club found, nothing to clear\n');
    }

    // Club: Swimming Australia affiliated, NSW, GST registered with
    // tax-inclusive pricing (the Australian convention). The ABN is
    // fictional; the digits pass the checksum but belong to no organisation.
    console.log('Creating Manly Sharks club...');
    const clubResult = await dataSource.query(
      `
      INSERT INTO clubs (
        name, slug, contact_email, phone, website,
        country, currency, timezone, locale,
        governing_body, governing_body_region, affiliation_number,
        tax_label, tax_rate, tax_inclusive, tax_registration_number,
        status
      )
      VALUES (
        'Manly Sharks Swimming Club', $1,
        'admin@manlysharks.com.au', '02 9976 5432', 'https://www.manlysharks.com.au',
        'AU', 'AUD', 'Australia/Sydney', 'en-AU',
        'SWIMMING_AUSTRALIA', 'NSW', 'NSW-2314',
        'GST', 10.00, true, '83914571560',
        'active'
      )
      RETURNING id
    `,
      [CLUB_SLUG],
    );
    const clubId = clubResult[0].id;
    console.log(`Club created (ID: ${clubId})\n`);

    // Staff users. All demo users share the password Demo2024!.
    console.log('Creating staff users...');
    const hashedPassword = await bcrypt.hash('Demo2024!', 10);

    const staffUsers = [
      ['megan.walsh@manlysharks.com.au', 'Megan', 'Walsh', 'super_admin'],
      ['daniel.nguyen@manlysharks.com.au', 'Daniel', 'Nguyen', 'head_coach'],
      ['priya.raman@manlysharks.com.au', 'Priya', 'Raman', 'squad_coach'],
      ['karen.boyd@manlysharks.com.au', 'Karen', 'Boyd', 'welfare_officer'],
      ['mark.jessop@manlysharks.com.au', 'Mark', 'Jessop', 'treasurer'],
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
    console.log(`Created ${staffUserIds.length} staff users\n`);

    // Families on Sydney's Northern Beaches. Phone numbers use the AU mobile
    // format 04xx xxx xxx; the numbers are fictional.
    console.log('Creating families...');
    const familyData = [
      {
        name: 'Walker Family',
        contact: 'Sophie Walker',
        email: 'sophie.walker@example.com',
        phone: '0412 555 101',
        address1: '12 Pittwater Road',
        city: 'Manly',
        postcode: '2095',
      },
      {
        name: 'Nguyen Family',
        contact: 'Linh Nguyen',
        email: 'linh.nguyen@example.com',
        phone: '0423 555 102',
        address1: '48 Howard Avenue',
        city: 'Dee Why',
        postcode: '2099',
      },
      {
        name: "O'Sullivan Family",
        contact: "Patrick O'Sullivan",
        email: 'patrick.osullivan@example.com',
        phone: '0431 555 103',
        address1: '7 Old Pittwater Road',
        city: 'Brookvale',
        postcode: '2100',
      },
      {
        name: 'Papadopoulos Family',
        contact: 'Elena Papadopoulos',
        email: 'elena.papadopoulos@example.com',
        phone: '0402 555 104',
        address1: '23 Oliver Street',
        city: 'Freshwater',
        postcode: '2096',
      },
      {
        name: 'Chen Family',
        contact: 'Wei Chen',
        email: 'wei.chen@example.com',
        phone: '0448 555 105',
        address1: '15 Harbord Road',
        city: 'Freshwater',
        postcode: '2096',
      },
      {
        name: 'Ricci Family',
        contact: 'Marco Ricci',
        email: 'marco.ricci@example.com',
        phone: '0416 555 106',
        address1: '3 Whistler Street',
        city: 'Manly',
        postcode: '2095',
      },
      {
        name: 'Harrington Family',
        contact: 'Kate Harrington',
        email: 'kate.harrington@example.com',
        phone: '0433 555 107',
        address1: '66 Pine Avenue',
        city: 'Brookvale',
        postcode: '2100',
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

    // Squads. Australian clubs race at carnivals and meets, not galas.
    console.log('Creating squads...');
    const squadData = [
      {
        key: 'lts',
        name: 'Learn to Swim',
        description:
          'Water confidence and stroke foundations for beginners aged 5 to 8. Fun, games and the first freestyle laps.',
        minAge: 5,
        maxAge: 8,
        coach: 'Priya Raman',
        times: 'Mon/Wed 16:00-16:45',
        capacity: 20,
      },
      {
        key: 'jd',
        name: 'Junior Development',
        description:
          'Stroke refinement and race preparation for members aged 9 to 12, building towards club nights and junior carnivals.',
        minAge: 9,
        maxAge: 12,
        coach: 'Priya Raman',
        times: 'Mon/Wed/Fri 16:45-18:00',
        capacity: 24,
      },
      {
        key: 'state',
        name: 'State Squad',
        description:
          'Competitive training for members aged 12 to 18 targeting NSW state age carnivals and national meets.',
        minAge: 12,
        maxAge: 18,
        coach: 'Daniel Nguyen',
        times: 'Tue/Thu 05:45-07:15, Mon/Wed/Fri 18:00-20:00, Sat 06:00-08:00',
        capacity: 20,
      },
    ];

    const squadIds: Record<string, string> = {};
    for (const s of squadData) {
      const result = await dataSource.query(
        `INSERT INTO squads (club_id, squad_name, description, min_age, max_age, coach_name, training_times, max_capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING squad_id`,
        [clubId, s.name, s.description, s.minAge, s.maxAge, s.coach, s.times, s.capacity],
      );
      squadIds[s.key] = result[0].squad_id;
    }
    console.log(`Created ${squadData.length} squads\n`);

    // Members with Swimming Australia style alphanumeric member numbers
    // (digits with a check letter, not the 7-digit Swim England format).
    console.log('Creating members...');
    type MemberRow = [string, string, string, string, string, number, string];
    // squadKey, firstName, lastName, dob, gender, familyIndex, memberNumber
    const memberData: MemberRow[] = [
      ['jd', 'Charlotte', 'Walker', '2016-03-12', 'F', 0, '1084211K'],
      ['state', 'Lachlan', 'Walker', '2012-08-04', 'M', 0, '1084212L'],
      ['lts', 'Mia', 'Nguyen', '2019-05-21', 'F', 1, '1084213M'],
      ['state', 'Ethan', 'Nguyen', '2011-11-30', 'M', 1, '1084214N'],
      ['jd', 'Siobhan', "O'Sullivan", '2016-02-17', 'F', 2, '1084215P'],
      ['lts', 'Nikos', 'Papadopoulos', '2019-09-09', 'M', 3, '1084216Q'],
      ['jd', 'Zoe', 'Papadopoulos', '2015-04-25', 'F', 3, '1084217R'],
      ['state', 'Amy', 'Chen', '2010-12-08', 'F', 4, '1084218S'],
      ['lts', 'Luca', 'Ricci', '2020-01-19', 'M', 5, '1084219T'],
      ['jd', 'Isabella', 'Ricci', '2016-07-02', 'F', 5, '1084220U'],
      ['state', 'Jack', 'Harrington', '2012-03-27', 'M', 6, '1084221V'],
      ['lts', 'Ruby', 'Harrington', '2019-10-13', 'F', 6, '1084222W'],
    ];

    const memberIds: string[] = [];
    for (const [squadKey, firstName, lastName, dob, gender, famIdx, memberNumber] of memberData) {
      const result = await dataSource.query(
        `INSERT INTO members (club_id, family_id, registration_number, governing_body, first_name, last_name, dob, gender, squad_id)
         VALUES ($1, $2, $3, 'SWIMMING_AUSTRALIA', $4, $5, $6, $7, $8)
         RETURNING member_id`,
        [
          clubId,
          familyIds[famIdx],
          memberNumber,
          firstName,
          lastName,
          dob,
          gender,
          squadIds[squadKey],
        ],
      );
      const memberId = result[0].member_id;
      memberIds.push(memberId);
      await dataSource.query('INSERT INTO squad_members (squad_id, member_id) VALUES ($1, $2)', [
        squadIds[squadKey],
        memberId,
      ]);
    }
    console.log(`Created ${memberIds.length} members\n`);

    // Fee structures in AUD. Amounts are GST-inclusive (the Australian
    // convention): the price shown is what the family pays and the 10% GST is
    // backed out of it on the invoice.
    // Note: the FeeFrequency enum currently supports monthly, annual and
    // one_time only. A per-term fee (e.g. 'Term 1 2027 Squad Fee') can be
    // added once a 'term' frequency exists.
    console.log('Creating fee structures...');
    const feeDefs = [
      {
        key: 'lts',
        name: 'Learn to Swim Monthly Fee',
        description: 'Monthly training fee for the Learn to Swim squad. Includes GST.',
        amount: 45.0,
        frequency: 'monthly',
        appliesToType: 'squad',
        appliesToId: () => squadIds['lts'],
      },
      {
        key: 'jd',
        name: 'Junior Development Monthly Fee',
        description: 'Monthly training fee for the Junior Development squad. Includes GST.',
        amount: 60.0,
        frequency: 'monthly',
        appliesToType: 'squad',
        appliesToId: () => squadIds['jd'],
      },
      {
        key: 'state',
        name: 'State Squad Monthly Fee',
        description: 'Monthly training fee for the State Squad. Includes GST.',
        amount: 82.5,
        frequency: 'monthly',
        appliesToType: 'squad',
        appliesToId: () => squadIds['state'],
      },
      {
        key: 'club',
        name: 'Annual Club Membership',
        description: 'Manly Sharks annual club membership fee. Includes GST.',
        amount: 110.0,
        frequency: 'annual',
        appliesToType: 'club',
        appliesToId: () => null as string | null,
      },
    ];

    const feeIds: Record<string, string> = {};
    for (const f of feeDefs) {
      const result = await dataSource.query(
        `INSERT INTO fee_structures (club_id, name, description, amount, currency, frequency, applies_to_type, applies_to_id, active)
         VALUES ($1, $2, $3, $4, 'AUD', $5, $6, $7, true)
         RETURNING fee_structure_id`,
        [clubId, f.name, f.description, f.amount, f.frequency, f.appliesToType, f.appliesToId()],
      );
      feeIds[f.key] = result[0].fee_structure_id;
    }
    console.log(`Created ${feeDefs.length} fee structures\n`);

    // Sessions at Manly Aquatic Centre. Times are club-local
    // (Australia/Sydney): early-morning State Squad swims and after-school
    // evening sessions. Past four weeks are completed, next two scheduled.
    console.log('Creating sessions...');
    const LOCATION = 'Manly Aquatic Centre';
    // squadKey, dayOfWeek (0=Sun..6=Sat), startTime, endTime, sessionName, coach
    const sessionTemplates: [string, number, string, string, string, string][] = [
      ['state', 2, '05:45', '07:15', 'State Squad - Tuesday Morning', 'Daniel Nguyen'],
      ['state', 4, '05:45', '07:15', 'State Squad - Thursday Morning', 'Daniel Nguyen'],
      ['state', 6, '06:00', '08:00', 'State Squad - Saturday Morning', 'Daniel Nguyen'],
      ['lts', 1, '16:00', '16:45', 'Learn to Swim - Monday Afternoon', 'Priya Raman'],
      ['lts', 3, '16:00', '16:45', 'Learn to Swim - Wednesday Afternoon', 'Priya Raman'],
      ['jd', 1, '16:45', '18:00', 'Junior Development - Monday Evening', 'Priya Raman'],
      ['jd', 3, '16:45', '18:00', 'Junior Development - Wednesday Evening', 'Priya Raman'],
      ['jd', 5, '16:45', '18:00', 'Junior Development - Friday Evening', 'Priya Raman'],
      ['state', 1, '18:00', '20:00', 'State Squad - Monday Evening', 'Daniel Nguyen'],
      ['state', 3, '18:00', '20:00', 'State Squad - Wednesday Evening', 'Daniel Nguyen'],
      ['state', 5, '18:00', '20:00', 'State Squad - Friday Evening', 'Daniel Nguyen'],
    ];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekOffsets = [-4, -3, -2, -1, 1, 2];

    const completedSessionsBySquad: Record<string, { sessionId: string; sessionIdx: number }[]> = {
      lts: [],
      jd: [],
      state: [],
    };
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
    const squadMemberIdx: Record<string, number[]> = { lts: [], jd: [], state: [] };
    memberData.forEach(([squadKey], idx) => squadMemberIdx[squadKey].push(idx));

    let attendanceCount = 0;
    for (const squadKey of ['lts', 'jd', 'state']) {
      for (const { sessionId, sessionIdx } of completedSessionsBySquad[squadKey]) {
        for (const memberIdx of squadMemberIdx[squadKey]) {
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

    // Invoices in AUD with GST applied. The club is tax-inclusive, so the sum
    // of the line items is the gross total the family pays and the 10% GST is
    // backed out of it: gross $82.50 is $7.50 GST on a $75.00 subtotal.
    console.log('Creating invoices...');
    const GST_RATE = 10;
    const squadFeeByKey: Record<string, number> = { lts: 45.0, jd: 60.0, state: 82.5 };
    const invoiceStatuses = ['paid', 'paid', 'pending', 'paid', 'overdue', 'pending', 'draft'];

    const issuedDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const dueDate = new Date(issuedDate);
    dueDate.setDate(dueDate.getDate() + 14);
    const monthLabel = issuedDate.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

    let invoiceCount = 0;
    let paymentCount = 0;
    for (let famIdx = 0; famIdx < familyIds.length; famIdx++) {
      const famMembers = memberData
        .map((row, idx) => ({ row, idx }))
        .filter(({ row }) => row[5] === famIdx);
      if (famMembers.length === 0) continue;

      const gross = roundTo2dp(famMembers.reduce((sum, { row }) => sum + squadFeeByKey[row[0]], 0));
      const { subtotal, tax } = gstFromGross(gross, GST_RATE);
      const status = invoiceStatuses[famIdx];
      const invoiceNumber = `MSSC-${issuedDate.getFullYear()}-${String(famIdx + 1).padStart(3, '0')}`;

      const invoiceResult = await dataSource.query(
        `INSERT INTO invoices (club_id, family_id, invoice_number, subtotal, tax_amount, total_amount, currency, issued_date, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'AUD', $7, $8, $9)
         RETURNING invoice_id`,
        [
          clubId,
          familyIds[famIdx],
          invoiceNumber,
          subtotal,
          tax,
          gross,
          formatDate(issuedDate),
          formatDate(dueDate),
          status,
        ],
      );
      const invoiceId = invoiceResult[0].invoice_id;

      for (const { row } of famMembers) {
        const [squadKey, firstName, lastName] = row;
        const fee = squadFeeByKey[squadKey];
        const squadName = squadData.find((s) => s.key === squadKey)?.name ?? squadKey;
        await dataSource.query(
          `INSERT INTO invoice_items (club_id, invoice_id, description, unit_price, quantity, total, fee_structure_id)
           VALUES ($1, $2, $3, $4, 1, $5, $6)`,
          [
            clubId,
            invoiceId,
            `${squadName} monthly fee - ${firstName} ${lastName} (${monthLabel})`,
            fee,
            fee,
            feeIds[squadKey],
          ],
        );
      }

      if (status === 'paid') {
        await dataSource.query(
          `INSERT INTO payments (club_id, invoice_id, amount, currency, payment_date, payment_method, status, provider, reference_number)
           VALUES ($1, $2, $3, 'AUD', $4, 'direct_debit', 'confirmed', 'gocardless', $5)`,
          [clubId, invoiceId, gross, formatDate(issuedDate), `PAY-${invoiceNumber}`],
        );
        paymentCount++;
      }
      invoiceCount++;
    }
    console.log(`Created ${invoiceCount} invoices and ${paymentCount} payments\n`);

    // Direct debit mandates on the BECS scheme (the Australian direct debit
    // system, the AU counterpart of Bacs in the UK seed).
    console.log('Creating BECS direct debit mandates...');
    const mandateFamilies = 5;
    for (let i = 0; i < mandateFamilies; i++) {
      await dataSource.query(
        `INSERT INTO direct_debit_mandates (club_id, family_id, provider, provider_mandate_id, status, scheme)
         VALUES ($1, $2, 'gocardless', $3, $4, 'becs')`,
        [
          clubId,
          familyIds[i],
          `MD-AU-${String(i + 1).padStart(6, '0')}`,
          i < mandateFamilies - 1 ? 'active' : 'pending',
        ],
      );
    }
    console.log(`Created ${mandateFamilies} mandates\n`);

    // Background checks. NSW volunteers hold Working With Children Checks
    // (WWC number format, five-year validity); Karen's is inside the 90-day
    // expiry window so the compliance dashboard shows an expiring check. One
    // interstate Blue Card (QLD) exercises the per-state check types from
    // GOVERNING_BODY_CONFIG. All certificate numbers are fictional.
    console.log('Creating background checks...');
    const backgroundChecks = [
      // user index, certificate, type, status, issue, expiry, notes
      [
        1,
        'WWC1234567E',
        'WORKING_WITH_CHILDREN_CHECK',
        'VALID',
        '2026-02-10',
        '2031-02-10',
        'Working With Children Check (NSW), paid employee category.',
      ],
      [
        2,
        'WWC2345678F',
        'WORKING_WITH_CHILDREN_CHECK',
        'VALID',
        '2026-04-02',
        '2031-04-02',
        'Working With Children Check (NSW), volunteer category.',
      ],
      [
        3,
        'WWC0987654D',
        'WORKING_WITH_CHILDREN_CHECK',
        'EXPIRING_SOON',
        '2021-09-15',
        '2026-09-15',
        'Working With Children Check (NSW). Renewal reminder sent.',
      ],
      [
        0,
        'BC-445566-1',
        'BLUE_CARD',
        'VALID',
        '2025-03-01',
        '2028-03-01',
        'Blue Card (QLD) held from previous club; NSW WWCC application in progress.',
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

    // Safeguarding officer: Swimming Australia clubs appoint a Member
    // Protection Information Officer (MPIO) rather than a Club Welfare
    // Officer.
    console.log('Creating safeguarding officer...');
    await dataSource.query(
      `INSERT INTO safeguarding_officers (club_id, name, role, email, phone, dbs_number, dbs_expiry, qualifications)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        clubId,
        'Karen Boyd',
        'Member Protection Information Officer (MPIO)',
        'karen.boyd@manlysharks.com.au',
        '0409 555 108',
        'WWC0987654D',
        '2026-09-15',
        'Play by the Rules MPIO training; Swimming Australia Safe Sport induction.',
      ],
    );
    console.log('Created 1 safeguarding officer (MPIO)\n');

    // Consents. Data sharing covers sharing member data with Swimming
    // Australia. Deterministic denials give the demo a realistic mix.
    console.log('Creating consent records...');
    let consentCount = 0;
    for (let i = 0; i < memberIds.length; i++) {
      const famIdx = memberData[i][5];
      const parentUserId = parentUserIds[famIdx];
      const consents: [string, string][] = [
        ['MEDICAL_TREATMENT', 'GRANTED'],
        ['PHOTOGRAPHY', i % 5 === 4 ? 'DENIED' : 'GRANTED'],
        ['DATA_SHARING', i % 7 === 6 ? 'DENIED' : 'GRANTED'],
      ];
      for (const [consentType, status] of consents) {
        await dataSource.query(
          `INSERT INTO consents (club_id, member_id, consent_type, status, granted_by_user_id, granted_date)
           VALUES ($1, $2, $3, $4, $5, '2026-02-01')`,
          [clubId, memberIds[i], consentType, status, parentUserId],
        );
        consentCount++;
      }
    }
    console.log(`Created ${consentCount} consent records\n`);

    // Competitions across the southern-hemisphere season (December to March).
    // The REGIONAL type renders as State in the AU interface.
    console.log('Creating competitions...');
    const competitions = [
      [
        'Manly Summer Carnival',
        'Manly Sharks Swimming Club',
        'Manly Aquatic Centre',
        '2026-12-12',
        '2026-12-13',
        'open_meet',
        'SC',
        'open',
        '2026-11-28 23:59:00',
      ],
      [
        'Club Night - February',
        'Manly Sharks Swimming Club',
        'Manly Aquatic Centre',
        '2027-02-12',
        null,
        'club_gala',
        'SC',
        'open',
        '2027-02-05 23:59:00',
      ],
      [
        'NSW State Age Championships 2027',
        'Swimming NSW',
        'Sydney Olympic Park Aquatic Centre',
        '2027-03-05',
        '2027-03-14',
        'regional',
        'LC',
        'draft',
        '2027-02-12 23:59:00',
      ],
    ];
    for (const [
      name,
      organiser,
      venue,
      start,
      end,
      type,
      course,
      status,
      deadline,
    ] of competitions) {
      await dataSource.query(
        `INSERT INTO competitions (club_id, name, organiser, venue, start_date, end_date, type, course, status, entry_deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [clubId, name, organiser, venue, start, end, type, course, status, deadline],
      );
    }
    console.log(`Created ${competitions.length} competitions\n`);

    console.log('Manly Sharks (AU) demo seed complete\n');
    console.log('Summary:');
    console.log(
      '  - 1 club (AU, AUD, Australia/Sydney, en-AU, Swimming Australia NSW, GST 10% inclusive)',
    );
    console.log(`  - ${staffUserIds.length} staff users, ${parentUserIds.length} parent users`);
    console.log(`  - ${familyIds.length} families`);
    console.log(`  - ${memberIds.length} members`);
    console.log(`  - ${squadData.length} squads`);
    console.log(`  - ${feeDefs.length} fee structures (AUD, GST-inclusive)`);
    console.log(`  - ${sessionCount} sessions at Manly Aquatic Centre`);
    console.log(`  - ${attendanceCount} attendance records`);
    console.log(`  - ${invoiceCount} invoices, ${paymentCount} payments`);
    console.log(`  - ${mandateFamilies} BECS direct debit mandates`);
    console.log(
      `  - ${backgroundChecks.length} background checks, 1 MPIO, ${consentCount} consents`,
    );
    console.log(`  - ${competitions.length} competitions`);
    console.log('\nDefault password for all users: Demo2024!');
    console.log('Admin login: megan.walsh@manlysharks.com.au\n');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seedAuDemoData()
  .then(() => {
    console.log('Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
