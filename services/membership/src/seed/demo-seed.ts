import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Demo seed script for RTW Monson Swimming Club
 * Creates comprehensive demo data including:
 * - Club settings
 * - Users (coaches, admins, parents)
 * - Families with realistic British addresses
 * - Members across multiple squads
 * - Sessions and attendance records
 * - Fee structures and invoices
 */

async function seedDemoData() {
  console.log('🌱 Starting RTW Monson demo seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await dataSource.query('TRUNCATE TABLE attendance CASCADE');
    await dataSource.query('TRUNCATE TABLE sessions CASCADE');
    await dataSource.query('TRUNCATE TABLE payments CASCADE');
    await dataSource.query('TRUNCATE TABLE invoice_items CASCADE');
    await dataSource.query('TRUNCATE TABLE invoices CASCADE');
    await dataSource.query('TRUNCATE TABLE direct_debit_mandates CASCADE');
    await dataSource.query('TRUNCATE TABLE fee_structures CASCADE');
    await dataSource.query('TRUNCATE TABLE squad_members CASCADE');
    await dataSource.query('TRUNCATE TABLE members CASCADE');
    await dataSource.query('TRUNCATE TABLE squads CASCADE');
    await dataSource.query('TRUNCATE TABLE families CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE club_settings CASCADE');
    console.log('✅ Data cleared\n');

    // Club Settings
    console.log('🏊 Creating RTW Monson club settings...');
    const clubResult = await dataSource.query(`
      INSERT INTO club_settings (
        club_name, address, contact_email, phone, website,
        locations, swim_england, billing_config
      )
      VALUES (
        'RTW Monson Swimming Club',
        '15 High Street, Royal Tunbridge Wells, Kent TN1 1UL',
        'admin@rtwmonson.co.uk',
        '01892 555123',
        'https://www.rtwmonson.co.uk',
        '[{"name": "Tunbridge Wells Sports Centre", "address": "St Johns Road, Tunbridge Wells, TN4 9TX", "poolType": "25m"}]'::jsonb,
        '{"clubNumber": "3SE123456", "region": "South East"}'::jsonb,
        '{"currency": "GBP", "taxRate": 0, "paymentMethods": ["card", "direct_debit", "bank_transfer"]}'::jsonb
      )
      RETURNING settings_id
    `);
    const clubId = clubResult[0].settings_id;
    console.log(`✅ Club created (ID: ${clubId})\n`);

    // Hash password for all users
    const hashedPassword = await bcrypt.hash('Demo2024!', 10);

    // Create Users
    console.log('👥 Creating users...');
    const users = await Promise.all([
      // Coaches and Admins
      dataSource.query(
        `
        INSERT INTO users (club_id, email, password_hash, first_name, last_name, role)
        VALUES ($1, 'mark.wilson@rtwmonson.co.uk', $2, 'Mark', 'Wilson', 'admin')
        RETURNING user_id
      `,
        [clubId, hashedPassword],
      ),
      dataSource.query(
        `
        INSERT INTO users (club_id, email, password_hash, first_name, last_name, role)
        VALUES ($1, 'sarah.thompson@rtwmonson.co.uk', $2, 'Sarah', 'Thompson', 'coach')
        RETURNING user_id
      `,
        [clubId, hashedPassword],
      ),
      dataSource.query(
        `
        INSERT INTO users (club_id, email, password_hash, first_name, last_name, role)
        VALUES ($1, 'james.mitchell@rtwmonson.co.uk', $2, 'James', 'Mitchell', 'admin')
        RETURNING user_id
      `,
        [clubId, hashedPassword],
      ),

      // Parent Users
      ...Array.from({ length: 15 }, (_, i) => {
        const names = [
          ['Emma', 'Davies'],
          ['Oliver', 'Roberts'],
          ['Sophie', 'Taylor'],
          ['Thomas', 'Anderson'],
          ['Charlotte', 'White'],
          ['Jack', 'Harris'],
          ['Jessica', 'Martin'],
          ['Harry', 'Clark'],
          ['Grace', 'Lewis'],
          ['George', 'Walker'],
          ['Lily', 'Hall'],
          ['Noah', 'Allen'],
          ['Amelia', 'Young'],
          ['William', 'King'],
          ['Isla', 'Wright'],
        ];
        const [firstName, lastName] = names[i];
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;

        return dataSource.query(
          `
          INSERT INTO users (club_id, email, password_hash, first_name, last_name, role)
          VALUES ($1, $2, $3, $4, $5, 'parent')
          RETURNING user_id
        `,
          [clubId, email, hashedPassword, firstName, lastName],
        );
      }),
    ]);
    console.log(`✅ Created ${users.length} users\n`);

    // Create Families
    console.log('👨‍👩‍👧‍👦 Creating families...');
    const familyData = [
      {
        name: 'Davies',
        contact: 'Emma Davies',
        email: 'emma.davies@example.com',
        phone: '07700 123456',
        address1: '12 London Road',
        address2: '',
        city: 'Tunbridge Wells',
        postcode: 'TN1 1AA',
      },
      {
        name: 'Roberts',
        contact: 'Oliver Roberts',
        email: 'oliver.roberts@example.com',
        phone: '07700 123457',
        address1: '45 Mount Pleasant',
        address2: '',
        city: 'Tonbridge',
        postcode: 'TN10 3BB',
      },
      {
        name: 'Taylor',
        contact: 'Sophie Taylor',
        email: 'sophie.taylor@example.com',
        phone: '07700 123458',
        address1: '78 Quarry Hill Road',
        address2: '',
        city: 'Tonbridge',
        postcode: 'TN10 4CC',
      },
      {
        name: 'Anderson',
        contact: 'Thomas Anderson',
        email: 'thomas.anderson@example.com',
        phone: '07700 123459',
        address1: '23 Prospect Road',
        address2: '',
        city: 'Sevenoaks',
        postcode: 'TN13 1DD',
      },
      {
        name: 'White',
        contact: 'Charlotte White',
        email: 'charlotte.white@example.com',
        phone: '07700 123460',
        address1: '56 High Street',
        address2: '',
        city: 'Sevenoaks',
        postcode: 'TN13 2EE',
      },
      {
        name: 'Harris',
        contact: 'Jack Harris',
        email: 'jack.harris@example.com',
        phone: '07700 123461',
        address1: '89 Pembury Road',
        address2: '',
        city: 'Tunbridge Wells',
        postcode: 'TN2 3FF',
      },
      {
        name: 'Martin',
        contact: 'Jessica Martin',
        email: 'jessica.martin@example.com',
        phone: '07700 123462',
        address1: '34 Calverley Park',
        address2: '',
        city: 'Tunbridge Wells',
        postcode: 'TN1 2GG',
      },
      {
        name: 'Clark',
        contact: 'Harry Clark',
        email: 'harry.clark@example.com',
        phone: '07700 123463',
        address1: '67 Grove Hill Road',
        address2: '',
        city: 'Tunbridge Wells',
        postcode: 'TN1 1HH',
      },
      {
        name: 'Lewis',
        contact: 'Grace Lewis',
        email: 'grace.lewis@example.com',
        phone: '07700 123464',
        address1: '90 London Road',
        address2: '',
        city: 'Tonbridge',
        postcode: 'TN10 4JJ',
      },
      {
        name: 'Walker',
        contact: 'George Walker',
        email: 'george.walker@example.com',
        phone: '07700 123465',
        address1: '12 St Johns Road',
        address2: '',
        city: 'Sevenoaks',
        postcode: 'TN13 3KK',
      },
      {
        name: 'Hall',
        contact: 'Lily Hall',
        email: 'lily.hall@example.com',
        phone: '07700 123466',
        address1: '45 Camden Road',
        address2: '',
        city: 'Tunbridge Wells',
        postcode: 'TN1 2LL',
      },
      {
        name: 'Allen',
        contact: 'Noah Allen',
        email: 'noah.allen@example.com',
        phone: '07700 123467',
        address1: '78 Crescent Road',
        address2: '',
        city: 'Tunbridge Wells',
        postcode: 'TN1 2MM',
      },
      {
        name: 'Young',
        contact: 'Amelia Young',
        email: 'amelia.young@example.com',
        phone: '07700 123468',
        address1: '23 Mount Sion',
        address2: '',
        city: 'Tunbridge Wells',
        postcode: 'TN1 1NN',
      },
      {
        name: 'King',
        contact: 'William King',
        email: 'william.king@example.com',
        phone: '07700 123469',
        address1: '56 Vale Road',
        address2: '',
        city: 'Tonbridge',
        postcode: 'TN9 1PP',
      },
      {
        name: 'Wright',
        contact: 'Isla Wright',
        email: 'isla.wright@example.com',
        phone: '07700 123470',
        address1: '89 Barden Road',
        address2: '',
        city: 'Tonbridge',
        postcode: 'TN10 3QQ',
      },
    ];

    const families = await Promise.all(
      familyData.map((f) =>
        dataSource.query(
          `
          INSERT INTO families (
            family_name, primary_contact_name, primary_contact_email, primary_contact_phone,
            address_line1, address_line2, city, postcode
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING family_id
        `,
          [f.name, f.contact, f.email, f.phone, f.address1, f.address2, f.city, f.postcode],
        ),
      ),
    );
    const familyIds = families.map((f) => f[0].family_id);
    console.log(`✅ Created ${familyIds.length} families\n`);

    // Create Squads
    console.log('🏊 Creating squads...');
    const squads = await Promise.all([
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times, max_capacity)
        VALUES (
          'Learn to Swim',
          'Introductory swimming for beginners aged 5 to 7',
          5, 7, 'Sarah Thompson',
          'Monday, Wednesday, Friday 16:00-17:00',
          25
        )
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times, max_capacity)
        VALUES (
          'Development Squad',
          'Developing technique and stamina for ages 8 to 10',
          8, 10, 'Sarah Thompson',
          'Monday, Wednesday, Friday 17:00-18:00',
          25
        )
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times, max_capacity)
        VALUES (
          'County Squad',
          'Competitive training for county level members aged 11 to 14',
          11, 14, 'Mark Wilson',
          'Monday, Wednesday, Friday 18:00-20:00, Saturday 08:00-10:00',
          20
        )
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times, max_capacity)
        VALUES (
          'Competition Squad',
          'Elite training for competitive members aged 14 to 18',
          14, 18, 'Mark Wilson',
          'Monday, Wednesday, Friday 18:00-20:00, Saturday 08:00-10:00',
          20
        )
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times, max_capacity)
        VALUES (
          'Masters',
          'Adult swimming for fitness and competition',
          25, 60, 'James Mitchell',
          'Monday, Wednesday 20:00-21:00',
          15
        )
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times, max_capacity)
        VALUES (
          'Water Polo',
          'Water polo skills and matches for all ages',
          10, 18, 'Mark Wilson',
          'Friday 20:00-21:30, Saturday 10:00-12:00',
          15
        )
        RETURNING squad_id
      `),
    ]);
    const squadIds = squads.map((s) => s[0].squad_id);
    console.log(`✅ Created ${squadIds.length} squads\n`);

    // Helper function to generate random date of birth
    const generateDOB = (minAge: number, maxAge: number): string => {
      const today = new Date();
      const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
      const year = today.getFullYear() - age;
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    };

    // Create Members
    console.log('🏊‍♀️ Creating members...');

    const firstNames = [
      'Oliver',
      'George',
      'Harry',
      'Jack',
      'Jacob',
      'Noah',
      'Charlie',
      'Muhammad',
      'Thomas',
      'Oscar',
      'Amelia',
      'Olivia',
      'Isla',
      'Emily',
      'Poppy',
      'Ava',
      'Isabella',
      'Jessica',
      'Lily',
      'Sophie',
      'William',
      'James',
      'Joshua',
      'Alfie',
      'Henry',
      'Leo',
      'Alexander',
      'Archie',
      'Ethan',
      'Freddie',
      'Mia',
      'Grace',
      'Evie',
      'Ella',
      'Charlotte',
      'Freya',
      'Florence',
      'Sophia',
      'Scarlett',
      'Chloe',
    ];

    const lastNames = [
      'Smith',
      'Jones',
      'Taylor',
      'Brown',
      'Williams',
      'Wilson',
      'Johnson',
      'Davies',
      'Robinson',
      'Wright',
      'Thompson',
      'Evans',
      'Walker',
      'White',
      'Roberts',
      'Green',
      'Hall',
      'Wood',
      'Jackson',
      'Clarke',
    ];

    const members = [];
    let memberCount = 0;

    // Learn to Swim (20 members)
    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const dob = generateDOB(5, 7);
      const gender = Math.random() > 0.5 ? 'M' : 'F';
      const familyId = familyIds[Math.floor(Math.random() * familyIds.length)];

      const result = await dataSource.query(
        `
        INSERT INTO members (family_id, club_id, first_name, last_name, dob, gender, squad_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING member_id
      `,
        [familyId, clubId, firstName, lastName, dob, gender, squadIds[0]],
      );

      members.push(result[0].member_id);
      memberCount++;
    }

    // Development Squad (20 members)
    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const dob = generateDOB(8, 10);
      const gender = Math.random() > 0.5 ? 'M' : 'F';
      const familyId = familyIds[Math.floor(Math.random() * familyIds.length)];
      const registrationNumber = `SE${(100000 + i).toString()}`;

      const result = await dataSource.query(
        `
        INSERT INTO members (family_id, club_id, registration_number, first_name, last_name, dob, gender, squad_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING member_id
      `,
        [familyId, clubId, registrationNumber, firstName, lastName, dob, gender, squadIds[1]],
      );

      members.push(result[0].member_id);
      memberCount++;
    }

    // County Squad (15 members)
    for (let i = 0; i < 15; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const dob = generateDOB(11, 14);
      const gender = Math.random() > 0.5 ? 'M' : 'F';
      const familyId = familyIds[Math.floor(Math.random() * familyIds.length)];
      const registrationNumber = `SE${(200000 + i).toString()}`;

      const result = await dataSource.query(
        `
        INSERT INTO members (family_id, club_id, registration_number, first_name, last_name, dob, gender, squad_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING member_id
      `,
        [familyId, clubId, registrationNumber, firstName, lastName, dob, gender, squadIds[2]],
      );

      members.push(result[0].member_id);
      memberCount++;
    }

    // Competition Squad (15 members)
    for (let i = 0; i < 15; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const dob = generateDOB(14, 18);
      const gender = Math.random() > 0.5 ? 'M' : 'F';
      const familyId = familyIds[Math.floor(Math.random() * familyIds.length)];
      const registrationNumber = `SE${(300000 + i).toString()}`;

      const result = await dataSource.query(
        `
        INSERT INTO members (family_id, club_id, registration_number, first_name, last_name, dob, gender, squad_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING member_id
      `,
        [familyId, clubId, registrationNumber, firstName, lastName, dob, gender, squadIds[3]],
      );

      members.push(result[0].member_id);
      memberCount++;
    }

    // Masters (8 members)
    for (let i = 0; i < 8; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const dob = generateDOB(25, 60);
      const gender = Math.random() > 0.5 ? 'M' : 'F';
      const familyId = familyIds[Math.floor(Math.random() * familyIds.length)];
      const registrationNumber = `SE${(400000 + i).toString()}`;

      const result = await dataSource.query(
        `
        INSERT INTO members (family_id, club_id, registration_number, first_name, last_name, dob, gender, squad_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING member_id
      `,
        [familyId, clubId, registrationNumber, firstName, lastName, dob, gender, squadIds[4]],
      );

      members.push(result[0].member_id);
      memberCount++;
    }

    // Water Polo (12 members - some overlap with other squads)
    const waterPoloMembers = [];
    for (let i = 0; i < 12; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const dob = generateDOB(10, 18);
      const gender = Math.random() > 0.5 ? 'M' : 'F';
      const familyId = familyIds[Math.floor(Math.random() * familyIds.length)];
      const registrationNumber = `SE${(500000 + i).toString()}`;

      const result = await dataSource.query(
        `
        INSERT INTO members (family_id, club_id, registration_number, first_name, last_name, dob, gender, squad_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING member_id
      `,
        [familyId, clubId, registrationNumber, firstName, lastName, dob, gender, squadIds[5]],
      );

      waterPoloMembers.push(result[0].member_id);
      members.push(result[0].member_id);
      memberCount++;
    }

    console.log(`✅ Created ${memberCount} members\n`);

    // Create Fee Structures
    console.log('💰 Creating fee structures...');
    const feeStructures = await Promise.all([
      dataSource.query(
        `
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, applies_to_id, active)
        VALUES ('Learn to Swim Monthly Fee', 'Monthly training fee for Learn to Swim squad', 25.00, 'monthly', 'squad', $1, true)
        RETURNING fee_structure_id
      `,
        [squadIds[0]],
      ),
      dataSource.query(
        `
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, applies_to_id, active)
        VALUES ('Development Squad Monthly Fee', 'Monthly training fee for Development squad', 35.00, 'monthly', 'squad', $1, true)
        RETURNING fee_structure_id
      `,
        [squadIds[1]],
      ),
      dataSource.query(
        `
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, applies_to_id, active)
        VALUES ('County Squad Monthly Fee', 'Monthly training fee for County squad', 55.00, 'monthly', 'squad', $1, true)
        RETURNING fee_structure_id
      `,
        [squadIds[2]],
      ),
      dataSource.query(
        `
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, applies_to_id, active)
        VALUES ('Competition Squad Monthly Fee', 'Monthly training fee for Competition squad', 70.00, 'monthly', 'squad', $1, true)
        RETURNING fee_structure_id
      `,
        [squadIds[3]],
      ),
      dataSource.query(
        `
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, applies_to_id, active)
        VALUES ('Masters Monthly Fee', 'Monthly training fee for Masters squad', 40.00, 'monthly', 'squad', $1, true)
        RETURNING fee_structure_id
      `,
        [squadIds[4]],
      ),
      dataSource.query(
        `
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, applies_to_id, active)
        VALUES ('Water Polo Monthly Fee', 'Monthly training fee for Water Polo', 45.00, 'monthly', 'squad', $1, true)
        RETURNING fee_structure_id
      `,
        [squadIds[5]],
      ),
      dataSource.query(
        `
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, applies_to_id, active)
        VALUES ('Annual Membership Fee', 'Annual club membership fee', 50.00, 'annual', 'club', $1, true)
        RETURNING fee_structure_id
      `,
        [clubId],
      ),
    ]);
    const feeStructureIds = feeStructures.map((f) => f[0].fee_structure_id);
    console.log(`✅ Created ${feeStructureIds.length} fee structures\n`);

    // Create Sessions for 3 months
    console.log('📅 Creating sessions for 3 months...');
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const endDate = new Date();

    const sessionIds = [];
    let sessionCount = 0;

    for (let squadIdx = 0; squadIdx < 4; squadIdx++) {
      const squadId = squadIds[squadIdx];
      const squadName = ['Learn to Swim', 'Development Squad', 'County Squad', 'Competition Squad'][
        squadIdx
      ];

      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();

        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const startTime = squadIdx < 2 ? (squadIdx === 0 ? '16:00' : '17:00') : '18:00';
          const endTime = squadIdx < 2 ? (squadIdx === 0 ? '17:00' : '18:00') : '20:00';

          const result = await dataSource.query(
            `
            INSERT INTO sessions (squad_id, session_name, session_date, start_time, end_time, location, coach_name, status)
            VALUES ($1, $2, $3, $4, $5, 'Tunbridge Wells Sports Centre', 'Sarah Thompson', 'completed')
            RETURNING session_id
          `,
            [squadId, `${squadName} Training`, dateStr, startTime, endTime],
          );

          sessionIds.push(result[0].session_id);
          sessionCount++;
        }

        if (dayOfWeek === 6 && squadIdx >= 2) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const result = await dataSource.query(
            `
            INSERT INTO sessions (squad_id, session_name, session_date, start_time, end_time, location, coach_name, status)
            VALUES ($1, $2, $3, '08:00', '10:00', 'Tunbridge Wells Sports Centre', 'Mark Wilson', 'completed')
            RETURNING session_id
          `,
            [squadId, `${squadName} Training`, dateStr],
          );

          sessionIds.push(result[0].session_id);
          sessionCount++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    console.log(`✅ Created ${sessionCount} sessions\n`);

    // Create Attendance Records
    console.log('✅ Creating attendance records...');
    let attendanceCount = 0;

    for (const sessionId of sessionIds) {
      const session = await dataSource.query(
        'SELECT squad_id FROM sessions WHERE session_id = $1',
        [sessionId],
      );
      const squadMembers = await dataSource.query(
        'SELECT member_id FROM members WHERE squad_id = $1',
        [session[0].squad_id],
      );

      for (const { member_id } of squadMembers) {
        const rand = Math.random();
        const status = rand < 0.85 ? 'present' : rand < 0.95 ? 'absent' : 'late';

        await dataSource.query(
          `
          INSERT INTO attendance (session_id, member_id, status, checked_in_at)
          VALUES ($1, $2, $3, $4)
        `,
          [
            sessionId,
            member_id,
            status,
            status === 'present' || status === 'late' ? new Date().toISOString() : null,
          ],
        );

        attendanceCount++;
      }
    }

    console.log(`✅ Created ${attendanceCount} attendance records\n`);

    // Create Invoices
    console.log('💷 Creating invoices...');
    let invoiceCount = 0;

    for (let i = 0; i < familyIds.length; i++) {
      const familyId = familyIds[i];
      const statusRand = Math.random();
      let status: string;

      if (statusRand < 0.6) status = 'paid';
      else if (statusRand < 0.85) status = 'pending';
      else if (statusRand < 0.95) status = 'overdue';
      else status = 'draft';

      const invoiceNumber = `INV-${(1000 + i).toString()}`;
      const issuedDate = new Date();
      issuedDate.setMonth(issuedDate.getMonth() - 1);
      const dueDate = new Date(issuedDate);
      dueDate.setDate(dueDate.getDate() + 14);

      const familyMembers = await dataSource.query(
        'SELECT squad_id FROM members WHERE family_id = $1 LIMIT 1',
        [familyId],
      );

      if (familyMembers.length > 0) {
        const squadId = familyMembers[0].squad_id;
        const feeStructure = await dataSource.query(
          'SELECT fee_structure_id, amount FROM fee_structures WHERE applies_to_id = $1 AND applies_to_type = $2',
          [squadId, 'squad'],
        );

        if (feeStructure.length > 0) {
          const amount = parseFloat(feeStructure[0].amount);

          const invoiceResult = await dataSource.query(
            `
            INSERT INTO invoices (
              family_id, invoice_number, subtotal, tax_amount, total_amount,
              due_date, issued_date, status
            )
            VALUES ($1, $2, $3, 0, $4, $5, $6, $7)
            RETURNING invoice_id
          `,
            [
              familyId,
              invoiceNumber,
              amount,
              amount,
              dueDate.toISOString().split('T')[0],
              issuedDate.toISOString().split('T')[0],
              status,
            ],
          );

          await dataSource.query(
            `
            INSERT INTO invoice_items (
              invoice_id, description, unit_price, quantity, total, fee_structure_id
            )
            VALUES ($1, $2, $3, 1, $4, $5)
          `,
            [
              invoiceResult[0].invoice_id,
              'Monthly training fee',
              amount,
              amount,
              feeStructure[0].fee_structure_id,
            ],
          );

          invoiceCount++;
        }
      }
    }

    console.log(`✅ Created ${invoiceCount} invoices\n`);

    console.log('🎉 RTW Monson demo seed complete!\n');
    console.log('Summary:');
    console.log(`  - 1 club`);
    console.log(`  - ${users.length} users`);
    console.log(`  - ${familyIds.length} families`);
    console.log(`  - ${memberCount} members`);
    console.log(`  - ${squadIds.length} squads`);
    console.log(`  - ${feeStructureIds.length} fee structures`);
    console.log(`  - ${sessionCount} sessions`);
    console.log(`  - ${attendanceCount} attendance records`);
    console.log(`  - ${invoiceCount} invoices`);
    console.log('\nDefault password for all users: Demo2024!\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seedDemoData()
  .then(() => {
    console.log('✅ Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
