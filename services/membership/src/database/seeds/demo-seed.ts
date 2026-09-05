/**
 * Comprehensive seed script for RTW Monson Swimming Club
 * Populates the database with realistic demo data for pilot testing.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx ts-node src/database/seeds/demo-seed.ts
 *   or via package.json: npm run seed
 *
 * Credentials: all users use password Demo2024!
 */

import { Client } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/swimly';

// --- Date helpers ---

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Return the nearest past occurrence of a given weekday (0=Sun...6=Sat) relative to anchor. */
function prevWeekday(anchor: Date, dayOfWeek: number): Date {
  const d = new Date(anchor);
  const diff = (d.getDay() - dayOfWeek + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

// --- Data definitions ---

// bcrypt hash of "Demo2024!" with 12 rounds
const PASSWORD_HASH = '$2b$12$qIc0ppI05w7pflXbn8UNRuw3LR0BmlWXiPSeSeXQR.ca1v1dNMXQG';

const STAFF_USERS = [
  {
    email: 'admin@rtwmonson.co.uk',
    firstName: 'Club',
    lastName: 'Admin',
    role: 'super_admin',
  },
  {
    email: 'treasurer@rtwmonson.co.uk',
    firstName: 'Helen',
    lastName: 'Clarke',
    role: 'treasurer',
  },
  {
    email: 'sarah.mitchell@rtwmonson.co.uk',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    role: 'head_coach',
  },
  {
    email: 'dave.thompson@rtwmonson.co.uk',
    firstName: 'Dave',
    lastName: 'Thompson',
    role: 'squad_coach',
  },
  {
    email: 'rachel.adams@rtwmonson.co.uk',
    firstName: 'Rachel',
    lastName: 'Adams',
    role: 'squad_coach',
  },
];

interface FamilyData {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
}

const FAMILIES: FamilyData[] = [
  {
    name: 'Johnson',
    contactName: 'Sarah Johnson',
    email: 'sarah.johnson@gmail.com',
    phone: '07700 900001',
    address: '14 Mount Pleasant Road',
    city: 'Tunbridge Wells',
    postcode: 'TN1 1QR',
  },
  {
    name: 'Williams',
    contactName: 'James Williams',
    email: 'james.williams@outlook.com',
    phone: '07700 900002',
    address: '7 Camden Road',
    city: 'Tunbridge Wells',
    postcode: 'TN1 2PT',
  },
  {
    name: 'Brown',
    contactName: 'Emma Brown',
    email: 'emma.brown@hotmail.co.uk',
    phone: '07700 900003',
    address: '22 St Johns Road',
    city: 'Tunbridge Wells',
    postcode: 'TN4 9TP',
  },
  {
    name: 'Taylor',
    contactName: 'David Taylor',
    email: 'david.taylor@gmail.com',
    phone: '07700 900004',
    address: '3 Broadwater Down',
    city: 'Tunbridge Wells',
    postcode: 'TN2 5NR',
  },
  {
    name: 'Davies',
    contactName: 'Claire Davies',
    email: 'claire.davies@icloud.com',
    phone: '07700 900005',
    address: '11 Pembury Road',
    city: 'Tunbridge Wells',
    postcode: 'TN2 3QN',
  },
  {
    name: 'Evans',
    contactName: 'Mark Evans',
    email: 'mark.evans@yahoo.co.uk',
    phone: '07700 900006',
    address: '45 London Road',
    city: 'Southborough',
    postcode: 'TN4 0PB',
  },
  {
    name: 'Wilson',
    contactName: 'Rachel Wilson',
    email: 'rachel.wilson@gmail.com',
    phone: '07700 900007',
    address: '8 Calverley Park',
    city: 'Tunbridge Wells',
    postcode: 'TN1 2JN',
  },
  {
    name: 'Thomas',
    contactName: 'Andrew Thomas',
    email: 'andrew.thomas@btinternet.com',
    phone: '07700 900008',
    address: '19 Warwick Park',
    city: 'Tunbridge Wells',
    postcode: 'TN2 5TA',
  },
  {
    name: 'Roberts',
    contactName: 'Helen Roberts',
    email: 'helen.roberts@gmail.com',
    phone: '07700 900009',
    address: '6 Hungershall Park',
    city: 'Tunbridge Wells',
    postcode: 'TN4 8NR',
  },
  {
    name: 'Clarke',
    contactName: 'Simon Clarke',
    email: 'simon.clarke@outlook.com',
    phone: '07700 900010',
    address: '31 Grosvenor Road',
    city: 'Tunbridge Wells',
    postcode: 'TN1 2AW',
  },
];

// squadKey, firstName, lastName, dob, gender, familyIndex, registrationNumber
type MemberRow = [string, string, string, string, string, number, string];

const MEMBERS: MemberRow[] = [
  // Learn to Swim (ages 5-8, born 2018-2021)
  ['lts', 'Oliver', 'Johnson', '2019-03-15', 'M', 0, 'SE126001'],
  ['lts', 'Amelia', 'Johnson', '2020-07-22', 'F', 0, 'SE126002'],
  ['lts', 'George', 'Williams', '2018-11-08', 'M', 1, 'SE126003'],
  ['lts', 'Isla', 'Brown', '2019-09-30', 'F', 2, 'SE126004'],
  ['lts', 'Noah', 'Taylor', '2020-01-14', 'M', 3, 'SE126005'],
  ['lts', 'Freya', 'Davies', '2018-06-25', 'F', 4, 'SE126006'],
  ['lts', 'Harry', 'Evans', '2019-12-03', 'M', 5, 'SE126007'],
  ['lts', 'Poppy', 'Wilson', '2020-04-19', 'F', 6, 'SE126008'],

  // Development (ages 9-12, born 2013-2017)
  ['dev', 'Jack', 'Williams', '2014-05-12', 'M', 1, 'SE126009'],
  ['dev', 'Ruby', 'Brown', '2015-08-27', 'F', 2, 'SE126010'],
  ['dev', 'Charlie', 'Brown', '2013-02-18', 'M', 2, 'SE126011'],
  ['dev', 'Lily', 'Taylor', '2014-10-05', 'F', 3, 'SE126012'],
  ['dev', 'Archie', 'Davies', '2015-03-21', 'M', 4, 'SE126013'],
  ['dev', 'Grace', 'Evans', '2013-11-09', 'F', 5, 'SE126014'],
  ['dev', 'Alfie', 'Thomas', '2014-07-30', 'M', 7, 'SE126015'],
  ['dev', 'Mia', 'Roberts', '2015-01-16', 'F', 8, 'SE126016'],
  ['dev', 'Reuben', 'Wilson', '2016-04-08', 'M', 6, 'SE126017'],
  ['dev', 'Sophia', 'Clarke', '2016-09-23', 'F', 9, 'SE126018'],

  // Competition (ages 13-18, born 2008-2013)
  ['comp', 'James', 'Johnson', '2010-04-08', 'M', 0, 'SE126019'],
  ['comp', 'Emily', 'Williams', '2009-09-14', 'F', 1, 'SE126020'],
  ['comp', 'Thomas', 'Taylor', '2011-01-27', 'M', 3, 'SE126021'],
  ['comp', 'Sophie', 'Davies', '2010-06-13', 'F', 4, 'SE126022'],
  ['comp', 'Ben', 'Evans', '2008-12-20', 'M', 5, 'SE126023'],
  ['comp', 'Ella', 'Wilson', '2011-08-04', 'F', 6, 'SE126024'],
  ['comp', 'Oscar', 'Thomas', '2009-03-17', 'M', 7, 'SE126025'],
  ['comp', 'Hannah', 'Roberts', '2010-11-29', 'F', 8, 'SE126026'],

  // Masters (adults, born 1975-1992)
  ['masters', 'David', 'Clarke', '1985-07-10', 'M', 9, 'SE126027'],
  ['masters', 'Sarah', 'Thomas', '1990-02-23', 'F', 7, 'SE126028'],
  ['masters', 'Andrew', 'Wilson', '1978-09-05', 'M', 6, 'SE126029'],
  ['masters', 'Claire', 'Roberts', '1988-04-18', 'F', 8, 'SE126030'],
];

// [squadKey, dayOfWeek (0=Sun,1=Mon,...,6=Sat), startTime, endTime, sessionName]
type SessionTemplate = [string, number, string, string, string];

const SESSION_TEMPLATES: SessionTemplate[] = [
  // Monday
  ['lts', 1, '17:00', '18:00', 'Learn to Swim - Monday Evening'],
  ['dev', 1, '18:00', '19:30', 'Development Squad - Monday Evening'],
  ['comp', 1, '19:30', '21:00', 'Competition Squad - Monday Evening'],
  // Wednesday
  ['dev', 3, '17:30', '19:00', 'Development Squad - Wednesday Evening'],
  ['comp', 3, '19:00', '20:30', 'Competition Squad - Wednesday Evening'],
  ['masters', 3, '20:30', '21:30', 'Masters - Wednesday Evening'],
  // Friday
  ['lts', 5, '17:00', '18:00', 'Learn to Swim - Friday Evening'],
  ['comp', 5, '18:00', '19:30', 'Competition Squad - Friday Evening'],
  ['masters', 5, '19:30', '20:30', 'Masters - Friday Evening'],
  // Saturday
  ['masters', 6, '06:00', '07:00', 'Masters - Saturday Morning'],
  ['comp', 6, '07:00', '09:00', 'Competition Squad - Saturday Morning'],
  ['lts', 6, '08:30', '09:30', 'Learn to Swim - Saturday Morning'],
  ['dev', 6, '09:30', '11:00', 'Development Squad - Saturday Morning'],
];

const SQUAD_FEES: Record<string, number> = {
  lts: 28.0,
  dev: 42.0,
  comp: 58.0,
  masters: 35.0,
};

const LOCATION = 'Tunbridge Wells Sports Centre, St Johns Road, TN4 9XB';

// Deterministic attendance status: 85% present, 8% absent, 7% late
function attendanceStatus(memberIdx: number, sessionIdx: number): string {
  const n = (memberIdx * 17 + sessionIdx * 7) % 100;
  if (n < 85) return 'present';
  if (n < 93) return 'absent';
  return 'late';
}

// --- Main seed function ---

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to database.');

  try {
    // Clear in dependency order
    console.log('Clearing existing data...');
    await client.query('DELETE FROM attendance');
    await client.query('DELETE FROM invoice_items');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM invoices');
    await client.query('DELETE FROM sessions');
    await client.query('DELETE FROM squad_members');
    await client.query('DELETE FROM members');
    await client.query('DELETE FROM fee_structures');
    await client.query('DELETE FROM squads');
    await client.query('DELETE FROM family_invites');
    await client.query('DELETE FROM families');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM club_settings');
    console.log('Existing data cleared.');

    // 1. Club settings
    console.log('Inserting club settings...');
    await client.query(
      `INSERT INTO club_settings (
        club_name, address, contact_email, phone, website,
        swim_england, locations, billing_config, notification_prefs
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        'RTW Monson Swimming Club',
        'Tunbridge Wells Sports Centre, St Johns Road, Royal Tunbridge Wells, Kent TN4 9XB',
        'secretary@rtwmonson.co.uk',
        '01892 555 000',
        'https://www.rtwmonson.co.uk',
        JSON.stringify({ affiliate_number: 'SW12345', region: 'South East' }),
        JSON.stringify([
          {
            name: 'Tunbridge Wells Sports Centre',
            address: 'St Johns Road, TN4 9XB',
            pool_length: 25,
            lanes: 6,
          },
        ]),
        JSON.stringify({
          currency: 'GBP',
          payment_due_days: 14,
          bank_name: 'Lloyds Bank',
          sort_code: '30-94-76',
          account_number: '12345678',
        }),
        JSON.stringify({ email: true, sms: false }),
      ],
    );

    // 2. Families
    console.log('Inserting families...');
    const familyIds: string[] = [];
    for (const f of FAMILIES) {
      const res = await client.query(
        `INSERT INTO families (
          family_name, primary_contact_name, primary_contact_email,
          primary_contact_phone, address_line1, city, postcode
        ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING family_id`,
        [f.name, f.contactName, f.email, f.phone, f.address, f.city, f.postcode],
      );
      familyIds.push(res.rows[0].family_id);
    }
    console.log(`  Inserted ${familyIds.length} families.`);

    // 3. Staff users (no family_id)
    console.log('Inserting staff users...');
    for (const u of STAFF_USERS) {
      await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, active)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [u.email, PASSWORD_HASH, u.firstName, u.lastName, u.role, true],
      );
    }
    console.log(`  Inserted ${STAFF_USERS.length} staff users.`);

    // 4. Parent users (one per family, linked via family_id)
    console.log('Inserting parent users...');
    for (let i = 0; i < FAMILIES.length; i++) {
      const f = FAMILIES[i];
      const nameParts = f.contactName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, active, family_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [f.email, PASSWORD_HASH, firstName, lastName, 'parent', true, familyIds[i]],
      );
    }
    console.log(`  Inserted ${FAMILIES.length} parent users.`);

    // 5. Squads
    console.log('Inserting squads...');
    const squadIdMap: Record<string, string> = {};

    const squadsData = [
      {
        key: 'lts',
        name: 'Learn to Swim',
        description:
          'Foundation programme for young members aged 5 to 8. Focus on water confidence, basic strokes, and fun.',
        minAge: 5,
        maxAge: 8,
        coach: 'Sarah Mitchell',
        times: 'Mon 17:00-18:00, Fri 17:00-18:00, Sat 08:30-09:30',
        capacity: 16,
      },
      {
        key: 'dev',
        name: 'Development',
        description:
          'Developing competitive skills for members aged 9 to 12. Stroke refinement and race preparation.',
        minAge: 9,
        maxAge: 12,
        coach: 'Dave Thompson',
        times: 'Mon 18:00-19:30, Wed 17:30-19:00, Sat 09:30-11:00',
        capacity: 20,
      },
      {
        key: 'comp',
        name: 'Competition',
        description:
          'High-performance training for members aged 13 to 18. Regional and national competition targets.',
        minAge: 13,
        maxAge: 18,
        coach: 'Rachel Adams',
        times: 'Mon 19:30-21:00, Wed 19:00-20:30, Fri 18:00-19:30, Sat 07:00-09:00',
        capacity: 20,
      },
      {
        key: 'masters',
        name: 'Masters',
        description:
          'Adult swimming for fitness and competition. All abilities welcome, ages 18 and above.',
        minAge: 18,
        maxAge: null,
        coach: 'Sarah Mitchell',
        times: 'Wed 20:30-21:30, Fri 19:30-20:30, Sat 06:00-07:00',
        capacity: 24,
      },
    ];

    for (const s of squadsData) {
      const res = await client.query(
        `INSERT INTO squads (
          squad_name, description, min_age, max_age, coach_name, training_times, max_capacity
        ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING squad_id`,
        [s.name, s.description, s.minAge, s.maxAge, s.coach, s.times, s.capacity],
      );
      squadIdMap[s.key] = res.rows[0].squad_id;
    }
    console.log(`  Inserted ${squadsData.length} squads.`);

    // 6. Members and squad_members
    console.log('Inserting members...');
    const memberIds: string[] = [];
    const memberSquadKeys: string[] = [];

    for (const sw of MEMBERS) {
      const [squadKey, firstName, lastName, dob, gender, famIdx, registrationNumber] = sw;
      const res = await client.query(
        `INSERT INTO members (
          family_id, registration_number, first_name, last_name, dob, gender, squad_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING member_id`,
        [familyIds[famIdx], registrationNumber, firstName, lastName, dob, gender, squadIdMap[squadKey]],
      );
      const memberId = res.rows[0].member_id;
      memberIds.push(memberId);
      memberSquadKeys.push(squadKey);

      await client.query(`INSERT INTO squad_members (squad_id, member_id) VALUES ($1,$2)`, [
        squadIdMap[squadKey],
        memberId,
      ]);
    }
    console.log(`  Inserted ${memberIds.length} members.`);

    // Build squad-to-members map for attendance
    const squadMembersMap: Record<string, string[]> = { lts: [], dev: [], comp: [], masters: [] };
    for (let i = 0; i < memberIds.length; i++) {
      const key = memberSquadKeys[i];
      squadMembersMap[key].push(memberIds[i]);
    }

    // 7. Fee structures
    console.log('Inserting fee structures...');
    const feeIds: Record<string, string> = {};

    const feeDefs = [
      {
        key: 'lts',
        name: 'Learn to Swim Monthly Fee',
        description: 'Monthly training fee for the Learn to Swim squad.',
        amount: 28.0,
        frequency: 'monthly',
        appliesToType: 'squad',
        appliesToId: () => squadIdMap['lts'],
      },
      {
        key: 'dev',
        name: 'Development Monthly Fee',
        description: 'Monthly training fee for the Development squad.',
        amount: 42.0,
        frequency: 'monthly',
        appliesToType: 'squad',
        appliesToId: () => squadIdMap['dev'],
      },
      {
        key: 'comp',
        name: 'Competition Monthly Fee',
        description: 'Monthly training fee for the Competition squad.',
        amount: 58.0,
        frequency: 'monthly',
        appliesToType: 'squad',
        appliesToId: () => squadIdMap['comp'],
      },
      {
        key: 'masters',
        name: 'Masters Monthly Fee',
        description: 'Monthly training fee for the Masters squad.',
        amount: 35.0,
        frequency: 'monthly',
        appliesToType: 'squad',
        appliesToId: () => squadIdMap['masters'],
      },
      {
        key: 'se',
        name: 'Swim England Annual Membership',
        description: 'Swim England annual membership (Cat 2 Compete).',
        amount: 33.95,
        frequency: 'annual',
        appliesToType: 'member',
        appliesToId: () => null,
      },
      {
        key: 'club',
        name: 'Annual Club Membership',
        description: 'RTW Monson annual club membership fee.',
        amount: 25.0,
        frequency: 'annual',
        appliesToType: 'club',
        appliesToId: () => null,
      },
    ];

    for (const f of feeDefs) {
      const res = await client.query(
        `INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, applies_to_id, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING fee_structure_id`,
        [f.name, f.description, f.amount, f.frequency, f.appliesToType, f.appliesToId(), true],
      );
      feeIds[f.key] = res.rows[0].fee_structure_id;
    }
    console.log(`  Inserted ${feeDefs.length} fee structures.`);

    // 8. Sessions: past 4 weeks (completed) + next 2 weeks (scheduled)
    console.log('Inserting sessions...');

    // Group session templates by squad key
    const sessionsBySquad: Record<string, { sessionId: string; sessionIdx: number }[]> = {
      lts: [],
      dev: [],
      comp: [],
      masters: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sessionCount = 0;
    let globalSessionIdx = 0;

    // Past 4 weeks: weeks -4, -3, -2, -1 from this week
    // Next 2 weeks: weeks +1, +2
    const weekOffsets = [-4, -3, -2, -1, 1, 2];

    for (const weekOffset of weekOffsets) {
      const isPast = weekOffset < 0;
      const status = isPast ? 'completed' : 'scheduled';

      // Find the Monday of the target week
      const monday = prevWeekday(today, 1);
      monday.setDate(monday.getDate() + weekOffset * 7);

      for (const [squadKey, dayOfWeek, startTime, endTime, sessionName] of SESSION_TEMPLATES) {
        // Calculate session date from Monday of that week
        const daysFromMon = (dayOfWeek + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
        const sessionDate = new Date(monday);
        sessionDate.setDate(monday.getDate() + daysFromMon);

        const squadId = squadIdMap[squadKey];
        const squadInfo = squadsData.find((s) => s.key === squadKey)!;

        const res = await client.query(
          `INSERT INTO sessions (
            squad_id, session_name, session_date, start_time, end_time,
            location, coach_name, max_participants, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING session_id`,
          [
            squadId,
            sessionName,
            formatDate(sessionDate),
            startTime,
            endTime,
            LOCATION,
            squadInfo.coach,
            squadInfo.capacity,
            status,
          ],
        );

        const sessionId = res.rows[0].session_id;
        sessionCount++;

        if (isPast) {
          sessionsBySquad[squadKey].push({ sessionId, sessionIdx: globalSessionIdx });
        }
        globalSessionIdx++;
      }
    }
    console.log(`  Inserted ${sessionCount} sessions.`);

    // 9. Attendance for completed sessions
    console.log('Inserting attendance records...');
    let attendanceCount = 0;

    for (const squadKey of ['lts', 'dev', 'comp', 'masters']) {
      const sqMembers = squadMembersMap[squadKey];
      const sqSessions = sessionsBySquad[squadKey];

      for (let si = 0; si < sqSessions.length; si++) {
        const { sessionId, sessionIdx } = sqSessions[si];

        for (let swi = 0; swi < sqMembers.length; swi++) {
          const memberId = sqMembers[swi];
          const status = attendanceStatus(swi, sessionIdx);

          await client.query(
            `INSERT INTO attendance (session_id, member_id, status, checked_in_at)
             VALUES ($1,$2,$3,$4)`,
            [sessionId, memberId, status, status !== 'absent' ? new Date().toISOString() : null],
          );
          attendanceCount++;
        }
      }
    }
    console.log(`  Inserted ${attendanceCount} attendance records.`);

    // 10. Invoices (one per family, February 2026)
    console.log('Inserting invoices...');
    const invoiceStatuses = [
      'paid', // Johnson
      'paid', // Williams
      'paid', // Brown
      'paid', // Taylor
      'pending', // Davies
      'pending', // Evans
      'pending', // Wilson
      'overdue', // Thomas
      'overdue', // Roberts
      'draft', // Clarke
    ];

    // Build family squad lookup (first member's squad key determines fee)
    const familyMembers: Record<number, { squadKey: string; memberId: string }[]> = {};
    for (let i = 0; i < FAMILIES.length; i++) {
      familyMembers[i] = [];
    }
    for (let i = 0; i < MEMBERS.length; i++) {
      const [squadKey, , , , , famIdx] = MEMBERS[i];
      familyMembers[famIdx].push({ squadKey, memberId: memberIds[i] });
    }

    let invoiceCount = 0;
    for (let famIdx = 0; famIdx < FAMILIES.length; famIdx++) {
      const familyId = familyIds[famIdx];
      const status = invoiceStatuses[famIdx];
      const invNumber = `RTW-2026-${String(famIdx + 1).padStart(3, '0')}`;

      const famMembersList = familyMembers[famIdx];
      if (famMembersList.length === 0) continue;

      // Calculate total from all members in this family
      let subtotal = 0;
      for (const { squadKey } of famMembersList) {
        subtotal += SQUAD_FEES[squadKey] ?? 0;
      }

      const invoiceRes = await client.query(
        `INSERT INTO invoices (
          family_id, invoice_number, subtotal, tax_amount, total_amount,
          issued_date, due_date, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING invoice_id`,
        [familyId, invNumber, subtotal, 0, subtotal, '2026-02-01', '2026-02-14', status],
      );
      const invoiceId = invoiceRes.rows[0].invoice_id;

      // Invoice items: one per member
      for (const { squadKey } of famMembersList) {
        const fee = SQUAD_FEES[squadKey] ?? 0;
        const squadName = squadsData.find((s) => s.key === squadKey)?.name ?? squadKey;
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, unit_price, quantity, total, fee_structure_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [invoiceId, `${squadName} monthly fee - February 2026`, fee, 1, fee, feeIds[squadKey]],
        );
      }

      invoiceCount++;
    }
    console.log(`  Inserted ${invoiceCount} invoices.`);

    // Done
    console.log('\n=== Seed complete ===');
    console.log(`  Club settings:      1`);
    console.log(`  Squads:             ${squadsData.length}`);
    console.log(`  Families:           ${familyIds.length}`);
    console.log(`  Users (staff):      ${STAFF_USERS.length}`);
    console.log(`  Users (parents):    ${FAMILIES.length}`);
    console.log(`  Members:           ${memberIds.length}`);
    console.log(`  Sessions:           ${sessionCount}`);
    console.log(`  Attendance records: ${attendanceCount}`);
    console.log(`  Fee structures:     ${feeDefs.length}`);
    console.log(`  Invoices:           ${invoiceCount}`);
    console.log('');
    console.log('Credentials: all users use password Demo2024!');
    console.log('Admin login:      admin@rtwmonson.co.uk');
    console.log('Head coach login: sarah.mitchell@rtwmonson.co.uk');
    console.log('Parent login:     sarah.johnson@gmail.com');
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
