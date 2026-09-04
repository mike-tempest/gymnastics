import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

async function seed() {
  console.log('Starting comprehensive seed process for RTW Monson Swimming Club...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // Clear existing data (in reverse order of dependencies)
    console.log('Clearing existing data...');
    await dataSource.query('TRUNCATE TABLE consents CASCADE');
    await dataSource.query('TRUNCATE TABLE dbs_checks CASCADE');
    await dataSource.query('TRUNCATE TABLE communications CASCADE');
    await dataSource.query('TRUNCATE TABLE attendance CASCADE');
    await dataSource.query('TRUNCATE TABLE sessions CASCADE');
    await dataSource.query('TRUNCATE TABLE payments CASCADE');
    await dataSource.query('TRUNCATE TABLE invoice_items CASCADE');
    await dataSource.query('TRUNCATE TABLE invoices CASCADE');
    await dataSource.query('TRUNCATE TABLE direct_debit_mandates CASCADE');
    await dataSource.query('TRUNCATE TABLE fee_structures CASCADE');
    await dataSource.query('TRUNCATE TABLE swimmers CASCADE');
    await dataSource.query('TRUNCATE TABLE squads CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE families CASCADE');
    await dataSource.query('TRUNCATE TABLE club_settings CASCADE');
    console.log('Existing data cleared\n');

    // Seed Club Settings
    console.log('Creating club settings...');
    await dataSource.query(`
      INSERT INTO club_settings (
        club_name, address, contact_email, phone, website,
        swim_england, locations, billing_config, notification_prefs
      )
      VALUES (
        'RTW Monson Swimming Club',
        '45 Monson Road, Tunbridge Wells, Kent, TN1 1LS',
        'info@rtwmonson.org.uk',
        '01892 555123',
        'https://www.rtwmonson.org.uk',
        '{"club_number": "SE123456", "region": "South East"}',
        '[{"name": "Monson Pool", "address": "Monson Road, Tunbridge Wells TN1 1LS"}, {"name": "Tunbridge Wells Sports Centre", "address": "St Johns Road, Tunbridge Wells TN4 9TX"}]',
        '{"currency": "GBP", "payment_methods": ["card", "direct_debit", "bank_transfer"]}',
        '{"email_enabled": true, "sms_enabled": true}'
      )
    `);
    console.log('Club settings created\n');

    // Seed Admin Users first (needed for DBS checks)
    console.log('Creating admin users...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    const adminUsers = await Promise.all([
      dataSource.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING user_id`,
        ['sarah.mitchell@rtwmonson.org.uk', hashedPassword, 'Sarah', 'Mitchell', 'ADMIN', true],
      ),
      dataSource.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING user_id`,
        ['tom.jenkins@rtwmonson.org.uk', hashedPassword, 'Tom', 'Jenkins', 'ADMIN', true],
      ),
    ]);
    const adminUserIds = adminUsers.map((u) => u[0].user_id);
    console.log(`Created ${adminUsers.length} admin users\n`);

    // Seed Families (20+ families)
    console.log('Creating families...');
    const familyData = [
      [
        'Thompson',
        'James Thompson',
        'james.thompson@gmail.com',
        '07891234501',
        '12 Calverley Park Gardens',
        'Tunbridge Wells',
        'TN1 2JX',
      ],
      [
        'Williams',
        'Sarah Williams',
        'sarah.williams@outlook.com',
        '07891234502',
        '28 Mount Pleasant Avenue',
        'Tunbridge Wells',
        'TN1 1NT',
      ],
      [
        'Patel',
        'Raj Patel',
        'raj.patel@yahoo.co.uk',
        '07891234503',
        '56 Frant Road',
        'Tunbridge Wells',
        'TN2 5LR',
      ],
      [
        "O'Connor",
        "Mary O'Connor",
        'mary.oconnor@gmail.com',
        '07891234504',
        '14 Broadwater Down',
        'Tunbridge Wells',
        'TN2 5NP',
      ],
      [
        'Zhang',
        'Wei Zhang',
        'wei.zhang@hotmail.com',
        '07891234505',
        '33 Warwick Park',
        'Tunbridge Wells',
        'TN2 5TA',
      ],
      [
        'Davies',
        'Robert Davies',
        'robert.davies@btinternet.com',
        '07891234506',
        '67 London Road',
        'Tunbridge Wells',
        'TN1 1DQ',
      ],
      [
        'Ahmed',
        'Fatima Ahmed',
        'fatima.ahmed@gmail.com',
        '07891234507',
        '89 Goods Station Road',
        'Tunbridge Wells',
        'TN1 2DJ',
      ],
      [
        'Brown',
        'Michael Brown',
        'michael.brown@outlook.com',
        '07891234508',
        '102 Pembury Road',
        'Tunbridge Wells',
        'TN2 3QU',
      ],
      [
        'Wilson',
        'Emma Wilson',
        'emma.wilson@yahoo.co.uk',
        '07891234509',
        '15 Culverden Down',
        'Tunbridge Wells',
        'TN4 9QY',
      ],
      [
        'Taylor',
        'David Taylor',
        'david.taylor@gmail.com',
        '07891234510',
        '42 High Street',
        'Tunbridge Wells',
        'TN1 1XN',
      ],
      [
        'Anderson',
        'Lucy Anderson',
        'lucy.anderson@btinternet.com',
        '07891234511',
        '78 St James Road',
        'Tunbridge Wells',
        'TN1 2HB',
      ],
      [
        'Thomas',
        'Peter Thomas',
        'peter.thomas@hotmail.com',
        '07891234512',
        '91 Church Road',
        'Tunbridge Wells',
        'TN1 1JP',
      ],
      [
        'Roberts',
        'Jennifer Roberts',
        'jennifer.roberts@gmail.com',
        '07891234513',
        '24 Modest Corner',
        'Tunbridge Wells',
        'TN2 5HA',
      ],
      [
        'Khan',
        'Imran Khan',
        'imran.khan@yahoo.co.uk',
        '07891234514',
        '58 Major York Road',
        'Tunbridge Wells',
        'TN1 2RZ',
      ],
      [
        'Lee',
        'Sophie Lee',
        'sophie.lee@outlook.com',
        '07891234515',
        '36 Farmcombe Road',
        'Tunbridge Wells',
        'TN2 5HN',
      ],
      [
        'Martin',
        'Andrew Martin',
        'andrew.martin@gmail.com',
        '07891234516',
        '71 Boyne Park',
        'Tunbridge Wells',
        'TN4 8ET',
      ],
      [
        'Jackson',
        'Claire Jackson',
        'claire.jackson@btinternet.com',
        '07891234517',
        '19 Molyneux Park Road',
        'Tunbridge Wells',
        'TN4 8BJ',
      ],
      [
        'White',
        'Simon White',
        'simon.white@hotmail.com',
        '07891234518',
        '83 Hungershall Park',
        'Tunbridge Wells',
        'TN4 8EZ',
      ],
      [
        'Harris',
        'Rachel Harris',
        'rachel.harris@yahoo.co.uk',
        '07891234519',
        '47 Bishops Down Park Road',
        'Tunbridge Wells',
        'TN4 9SX',
      ],
      [
        'Clark',
        'Jonathan Clark',
        'jonathan.clark@gmail.com',
        '07891234520',
        '62 Quarry Road',
        'Tunbridge Wells',
        'TN1 2EU',
      ],
      [
        'Lewis',
        'Helen Lewis',
        'helen.lewis@outlook.com',
        '07891234521',
        '95 St Johns Road',
        'Tunbridge Wells',
        'TN4 9TX',
      ],
      [
        'Walker',
        'Paul Walker',
        'paul.walker@btinternet.com',
        '07891234522',
        '11 Camden Road',
        'Tunbridge Wells',
        'TN1 2PT',
      ],
    ];

    const families = await Promise.all(
      familyData.map(([name, contact, email, phone, address, city, postcode]) =>
        dataSource.query(
          `INSERT INTO families (family_name, primary_contact_name, primary_contact_email, primary_contact_phone, address_line1, city, postcode)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING family_id`,
          [`${name} Family`, contact, email, phone, address, city, postcode],
        ),
      ),
    );
    const familyIds = families.map((f) => f[0].family_id);
    console.log(`Created ${families.length} families\n`);

    // Create parent users for each family
    console.log('Creating parent users...');
    const parentUsers = await Promise.all(
      familyData.map(([name, contact, email], idx) =>
        dataSource.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, active, family_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING user_id`,
          [email, hashedPassword, contact.split(' ')[0], name, 'PARENT', true, familyIds[idx]],
        ),
      ),
    );
    console.log(`Created ${parentUsers.length} parent users\n`);

    // Seed Squads (6 squads as required)
    console.log('Creating squads...');
    const squads = await Promise.all([
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times)
        VALUES ('Learn to Swim', 'Beginner swimmers learning basic techniques', 6, 10, 'Coach Emma Davies', 'Mon/Wed/Fri 16:00-17:00')
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times)
        VALUES ('Development', 'Developing stroke technique and endurance', 10, 14, 'Coach Tom Jenkins', 'Tue/Thu/Sat 17:00-18:30')
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times)
        VALUES ('Junior Competition', 'Competitive training for junior swimmers', 11, 16, 'Coach Sarah Mitchell', 'Mon/Wed/Fri 17:30-19:00, Sat 09:00-11:00')
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times)
        VALUES ('Senior Competition', 'Elite competitive training for senior swimmers', 15, 25, 'Coach Sarah Mitchell', 'Mon-Fri 06:00-07:30, Tue/Thu 19:00-20:30')
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times)
        VALUES ('Masters', 'Adult fitness and competitive swimming', 25, 99, 'Coach Mark Stevens', 'Mon/Wed 20:00-21:00, Sat 07:00-08:30')
        RETURNING squad_id
      `),
      dataSource.query(`
        INSERT INTO squads (squad_name, description, min_age, max_age, coach_name, training_times)
        VALUES ('Water Polo', 'Water polo skills and team play', 12, 99, 'Coach Alex Murphy', 'Tue/Thu 19:00-20:30, Sun 10:00-12:00')
        RETURNING squad_id
      `),
    ]);
    const squadIds = squads.map((s) => s[0].squad_id);
    console.log(`Created ${squads.length} squads\n`);

    // Seed Swimmers (40+ swimmers across different age groups)
    console.log('Creating swimmers...');
    const swimmerData = [
      // Learn to Swim squad (ages 6-10)
      [familyIds[0], squadIds[0], 'Oliver', 'Thompson', '2017-04-15', 'M', 'SE345001'],
      [familyIds[1], squadIds[0], 'Amelia', 'Williams', '2016-09-22', 'F', 'SE345002'],
      [familyIds[2], squadIds[0], 'Aarav', 'Patel', '2017-11-08', 'M', 'SE345003'],
      [familyIds[4], squadIds[0], 'Lily', 'Zhang', '2016-05-14', 'F', 'SE345004'],
      [familyIds[6], squadIds[0], 'Yusuf', 'Ahmed', '2018-01-20', 'M', 'SE345005'],
      [familyIds[10], squadIds[0], 'Grace', 'Anderson', '2017-07-30', 'F', 'SE345006'],

      // Development squad (ages 10-14)
      [familyIds[0], squadIds[1], 'Charlotte', 'Thompson', '2014-02-10', 'F', 'SE345007'],
      [familyIds[3], squadIds[1], 'Sean', "O'Connor", '2013-06-18', 'M', 'SE345008'],
      [familyIds[5], squadIds[1], 'Emily', 'Davies', '2014-11-25', 'F', 'SE345009'],
      [familyIds[7], squadIds[1], 'James', 'Brown', '2012-08-03', 'M', 'SE345010'],
      [familyIds[8], squadIds[1], 'Sophie', 'Wilson', '2013-04-12', 'F', 'SE345011'],
      [familyIds[9], squadIds[1], 'Daniel', 'Taylor', '2014-09-07', 'M', 'SE345012'],
      [familyIds[12], squadIds[1], 'Mia', 'Roberts', '2013-12-15', 'F', 'SE345013'],
      [familyIds[14], squadIds[1], 'Ryan', 'Lee', '2014-03-28', 'M', 'SE345014'],

      // Junior Competition squad (ages 11-16)
      [familyIds[1], squadIds[2], 'Benjamin', 'Williams', '2011-10-05', 'M', 'SE345015'],
      [familyIds[2], squadIds[2], 'Priya', 'Patel', '2012-07-19', 'F', 'SE345016'],
      [familyIds[5], squadIds[2], 'Thomas', 'Davies', '2010-03-22', 'M', 'SE345017'],
      [familyIds[11], squadIds[2], 'Isabella', 'Thomas', '2011-05-08', 'F', 'SE345018'],
      [familyIds[13], squadIds[2], 'Zayn', 'Khan', '2012-01-14', 'M', 'SE345019'],
      [familyIds[15], squadIds[2], 'Lucy', 'Martin', '2010-11-30', 'F', 'SE345020'],
      [familyIds[16], squadIds[2], 'Oscar', 'Jackson', '2011-08-17', 'M', 'SE345021'],
      [familyIds[18], squadIds[2], 'Evie', 'Harris', '2012-04-23', 'F', 'SE345022'],

      // Senior Competition squad (ages 15-25)
      [familyIds[3], squadIds[3], 'Liam', "O'Connor", '2009-02-11', 'M', 'SE345023'],
      [familyIds[4], squadIds[3], 'Meilin', 'Zhang', '2008-09-26', 'F', 'SE345024'],
      [familyIds[7], squadIds[3], 'Joshua', 'Brown', '2009-12-08', 'M', 'SE345025'],
      [familyIds[8], squadIds[3], 'Chloe', 'Wilson', '2008-05-15', 'F', 'SE345026'],
      [familyIds[17], squadIds[3], 'Ethan', 'White', '2009-07-04', 'M', 'SE345027'],
      [familyIds[19], squadIds[3], 'Hannah', 'Clark', '2008-11-20', 'F', 'SE345028'],

      // Masters squad (adults 25+)
      [familyIds[6], squadIds[4], 'Aisha', 'Ahmed', '1995-06-12', 'F', 'SE345029'],
      [familyIds[9], squadIds[4], 'Rebecca', 'Taylor', '1992-03-18', 'F', 'SE345030'],
      [familyIds[10], squadIds[4], 'Matthew', 'Anderson', '1988-09-25', 'M', 'SE345031'],
      [familyIds[14], squadIds[4], 'Catherine', 'Lee', '1990-11-07', 'F', 'SE345032'],
      [familyIds[20], squadIds[4], 'Richard', 'Lewis', '1985-04-22', 'M', 'SE345033'],
      [familyIds[21], squadIds[4], 'Victoria', 'Walker', '1993-08-14', 'F', 'SE345034'],

      // Water Polo squad
      [familyIds[11], squadIds[5], 'Alexander', 'Thomas', '2009-01-29', 'M', 'SE345035'],
      [familyIds[12], squadIds[5], 'Olivia', 'Roberts', '2010-10-11', 'F', 'SE345036'],
      [familyIds[13], squadIds[5], 'Adam', 'Khan', '2008-07-16', 'M', 'SE345037'],
      [familyIds[15], squadIds[5], 'Jessica', 'Martin', '2009-03-05', 'F', 'SE345038'],
      [familyIds[16], squadIds[5], 'Nathan', 'Jackson', '2007-12-20', 'M', 'SE345039'],
      [familyIds[17], squadIds[5], 'Emma', 'White', '2010-05-28', 'F', 'SE345040'],
      [familyIds[18], squadIds[5], 'William', 'Harris', '2008-09-03', 'M', 'SE345041'],
      [familyIds[19], squadIds[5], 'Sophia', 'Clark', '2011-02-17', 'F', 'SE345042'],
    ];

    const swimmers = await Promise.all(
      swimmerData.map(([familyId, squadId, firstName, lastName, dob, gender, seNumber]) =>
        dataSource.query(
          `INSERT INTO swimmers (family_id, squad_id, first_name, last_name, dob, gender, se_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING swimmer_id`,
          [familyId, squadId, firstName, lastName, dob, gender, seNumber],
        ),
      ),
    );
    const swimmerIds = swimmers.map((s) => s[0].swimmer_id);
    console.log(`Created ${swimmers.length} swimmers\n`);

    // Seed Fee Structures
    console.log('Creating fee structures...');
    const feeStructures = await Promise.all([
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Learn to Swim Monthly Fee', 'Monthly training fees for Learn to Swim squad', 35.00, 'monthly', 'squad', true)
        RETURNING fee_structure_id
      `),
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Development Monthly Fee', 'Monthly training fees for Development squad', 45.00, 'monthly', 'squad', true)
        RETURNING fee_structure_id
      `),
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Junior Competition Monthly Fee', 'Monthly training fees for Junior Competition squad', 55.00, 'monthly', 'squad', true)
        RETURNING fee_structure_id
      `),
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Senior Competition Monthly Fee', 'Monthly training fees for Senior Competition squad', 65.00, 'monthly', 'squad', true)
        RETURNING fee_structure_id
      `),
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Masters Monthly Fee', 'Monthly training fees for Masters squad', 40.00, 'monthly', 'squad', true)
        RETURNING fee_structure_id
      `),
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Water Polo Monthly Fee', 'Monthly training fees for Water Polo squad', 50.00, 'monthly', 'squad', true)
        RETURNING fee_structure_id
      `),
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Annual Membership', 'Annual club membership fee', 25.00, 'annual', 'club', true)
        RETURNING fee_structure_id
      `),
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Swim England Membership', 'Swim England annual membership', 33.95, 'annual', 'swimmer', true)
        RETURNING fee_structure_id
      `),
      dataSource.query(`
        INSERT INTO fee_structures (name, description, amount, frequency, applies_to_type, active)
        VALUES ('Gala Entry Fee', 'Competition gala entry fee', 15.00, 'one_time', 'swimmer', true)
        RETURNING fee_structure_id
      `),
    ]);
    const feeStructureIds = feeStructures.map((f) => f[0].fee_structure_id);
    console.log(`Created ${feeStructures.length} fee structures\n`);

    // Seed Sessions (3 months worth: Oct-Dec 2025)
    console.log('Creating sessions for Oct-Dec 2025...');
    const sessionDates = [];
    for (let month = 10; month <= 12; month++) {
      const daysInMonth = new Date(2025, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        sessionDates.push(new Date(2025, month - 1, day));
      }
    }

    const sessionData: (string | number)[][] = [];
    sessionDates.forEach((date) => {
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, etc.

      // Learn to Swim: Mon/Wed/Fri 16:00-17:00
      if ([1, 3, 5].includes(dayOfWeek)) {
        sessionData.push([
          squadIds[0],
          'Learn to Swim Session',
          date.toISOString().split('T')[0],
          '16:00',
          '17:00',
          'Monson Pool',
          'Coach Emma Davies',
          'completed',
        ]);
      }

      // Development: Tue/Thu/Sat 17:00-18:30
      if ([2, 4, 6].includes(dayOfWeek)) {
        sessionData.push([
          squadIds[1],
          'Development Squad Training',
          date.toISOString().split('T')[0],
          '17:00',
          '18:30',
          'Monson Pool',
          'Coach Tom Jenkins',
          'completed',
        ]);
      }

      // Junior Competition: Mon/Wed/Fri 17:30-19:00, Sat 09:00-11:00
      if ([1, 3, 5].includes(dayOfWeek)) {
        sessionData.push([
          squadIds[2],
          'Junior Competition Training',
          date.toISOString().split('T')[0],
          '17:30',
          '19:00',
          'TW Sports Centre',
          'Coach Sarah Mitchell',
          'completed',
        ]);
      }
      if (dayOfWeek === 6) {
        sessionData.push([
          squadIds[2],
          'Junior Competition Saturday Session',
          date.toISOString().split('T')[0],
          '09:00',
          '11:00',
          'TW Sports Centre',
          'Coach Sarah Mitchell',
          'completed',
        ]);
      }

      // Senior Competition: Mon-Fri 06:00-07:30
      if ([1, 2, 3, 4, 5].includes(dayOfWeek)) {
        sessionData.push([
          squadIds[3],
          'Senior Competition Morning Training',
          date.toISOString().split('T')[0],
          '06:00',
          '07:30',
          'TW Sports Centre',
          'Coach Sarah Mitchell',
          'completed',
        ]);
      }

      // Masters: Mon/Wed 20:00-21:00, Sat 07:00-08:30
      if ([1, 3].includes(dayOfWeek)) {
        sessionData.push([
          squadIds[4],
          'Masters Evening Session',
          date.toISOString().split('T')[0],
          '20:00',
          '21:00',
          'Monson Pool',
          'Coach Mark Stevens',
          'completed',
        ]);
      }
      if (dayOfWeek === 6) {
        sessionData.push([
          squadIds[4],
          'Masters Saturday Morning',
          date.toISOString().split('T')[0],
          '07:00',
          '08:30',
          'Monson Pool',
          'Coach Mark Stevens',
          'completed',
        ]);
      }

      // Water Polo: Tue/Thu 19:00-20:30, Sun 10:00-12:00
      if ([2, 4].includes(dayOfWeek)) {
        sessionData.push([
          squadIds[5],
          'Water Polo Training',
          date.toISOString().split('T')[0],
          '19:00',
          '20:30',
          'TW Sports Centre',
          'Coach Alex Murphy',
          'completed',
        ]);
      }
      if (dayOfWeek === 0) {
        sessionData.push([
          squadIds[5],
          'Water Polo Sunday Match',
          date.toISOString().split('T')[0],
          '10:00',
          '12:00',
          'TW Sports Centre',
          'Coach Alex Murphy',
          'completed',
        ]);
      }
    });

    // Only create sessions up to today (avoid future sessions)
    const today = new Date('2026-01-15');
    const completedSessions = sessionData.filter((s) => new Date(s[2]) < today);

    const sessions = [];
    for (const sessionInfo of completedSessions) {
      const result = await dataSource.query(
        `INSERT INTO sessions (squad_id, session_name, session_date, start_time, end_time, location, coach_name, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING session_id`,
        sessionInfo,
      );
      sessions.push(result[0]);
    }
    const sessionIds = sessions.map((s) => s.session_id);
    console.log(`Created ${sessions.length} sessions\n`);

    // Seed Attendance (realistic patterns: 80-90% attendance)
    console.log('Creating attendance records...');
    let attendanceCount = 0;

    for (const session of sessions) {
      const sessionSquadId = session.squad_id;
      const relevantSwimmers = swimmerData
        .map((s, idx: number) => ({ data: s, id: swimmerIds[idx] }))
        .filter((s) => s.data[1] === sessionSquadId);

      for (const swimmer of relevantSwimmers) {
        const randomVal = Math.random();
        let status = 'present';

        // 85% present, 8% absent, 7% late
        if (randomVal > 0.93) {
          status = 'absent';
        } else if (randomVal > 0.85) {
          status = 'late';
        }

        // Some swimmers have dropoff patterns (skip last 20% of sessions)
        const isDropoffSwimmer = swimmer.id === swimmerIds[5] || swimmer.id === swimmerIds[12];
        const sessionIndex = sessionIds.indexOf(session.session_id);
        const isLateSession = sessionIndex > sessionIds.length * 0.8;

        if (isDropoffSwimmer && isLateSession && Math.random() > 0.3) {
          status = 'absent';
        }

        await dataSource.query(
          `INSERT INTO attendance (session_id, swimmer_id, status)
           VALUES ($1, $2, $3)`,
          [session.session_id, swimmer.id, status],
        );
        attendanceCount++;
      }
    }
    console.log(`Created ${attendanceCount} attendance records\n`);

    // Seed Invoices (3 months: Oct, Nov, Dec 2025)
    console.log('Creating invoices...');
    const invoices = [];

    for (let month = 10; month <= 12; month++) {
      const invoiceDate = new Date(2025, month - 1, 1);
      const dueDate = new Date(2025, month - 1, 28);

      for (let i = 0; i < familyIds.length; i++) {
        const familyId = familyIds[i];
        const familySwimmers = swimmerData
          .map((s, idx: number) => ({ data: s, idx }))
          .filter((s) => s.data[0] === familyId);

        if (familySwimmers.length === 0) continue;

        let subtotal = 0;
        const items: (string | number)[][] = [];

        familySwimmers.forEach((swimmer) => {
          const squadIndex = squadIds.indexOf(swimmer.data[1]);
          const fee = [35, 45, 55, 65, 40, 50][squadIndex];
          subtotal += fee;
          items.push([swimmer.data[2], swimmer.data[3], squadIndex, fee]);
        });

        // Determine payment status based on family (realistic mix)
        let status = 'paid';
        if (i === 3 || i === 18) {
          // Families 3 and 18 are behind on payments
          status = month === 12 ? 'overdue' : month === 11 ? 'pending' : 'paid';
        } else if (i === 7 || i === 14) {
          // Families 7 and 14 sometimes pay late
          status = month === 12 ? 'pending' : 'paid';
        }

        const invoiceNum = `INV-2025-${String(month).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`;

        const invoice = await dataSource.query(
          `INSERT INTO invoices (family_id, invoice_number, issued_date, due_date, subtotal, tax_amount, total_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING invoice_id`,
          [
            familyId,
            invoiceNum,
            invoiceDate.toISOString().split('T')[0],
            dueDate.toISOString().split('T')[0],
            subtotal,
            0,
            subtotal,
            status,
          ],
        );

        const invoiceId = invoice[0].invoice_id;

        // Create invoice items
        for (const [firstName, lastName, squadIdxRaw, fee] of items) {
          const squadIdx = squadIdxRaw as number;
          const squadNames = [
            'Learn to Swim',
            'Development',
            'Junior Competition',
            'Senior Competition',
            'Masters',
            'Water Polo',
          ];
          await dataSource.query(
            `INSERT INTO invoice_items (invoice_id, description, unit_price, quantity, total, fee_structure_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              invoiceId,
              `${squadNames[squadIdx]} - ${firstName} ${lastName}`,
              fee,
              1,
              fee,
              feeStructureIds[squadIdx],
            ],
          );
        }

        // Create payment if invoice is paid
        if (status === 'paid') {
          const paymentDate = new Date(2025, month - 1, Math.floor(Math.random() * 10) + 5);
          const paymentMethod = Math.random() > 0.5 ? 'direct_debit' : 'card';
          await dataSource.query(
            `INSERT INTO payments (invoice_id, amount, payment_date, payment_method, status, reference_number)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              invoiceId,
              subtotal,
              paymentDate.toISOString().split('T')[0],
              paymentMethod,
              'confirmed',
              `PAY-${invoiceNum}`,
            ],
          );
        }

        invoices.push(invoice[0]);
      }
    }
    console.log(`Created ${invoices.length} invoices\n`);

    // Seed Direct Debit Mandates
    console.log('Creating Direct Debit mandates...');
    const mandateCount = Math.floor(familyIds.length * 0.7); // 70% of families have DD
    const mandates = [];

    for (let i = 0; i < mandateCount; i++) {
      await dataSource.query(
        `INSERT INTO direct_debit_mandates (family_id, provider_mandate_id, status, scheme)
         VALUES ($1, $2, $3, $4)`,
        [
          familyIds[i],
          `MD${String(i + 1).padStart(6, '0')}`,
          i < mandateCount - 2 ? 'active' : 'pending',
          'bacs',
        ],
      );
      mandates.push(i);
    }
    console.log(`Created ${mandates.length} Direct Debit mandates\n`);

    // Seed DBS Checks for admin users
    console.log('Creating DBS checks...');
    const dbsChecks = await Promise.all([
      dataSource.query(
        `INSERT INTO dbs_checks (user_id, certificate_number, check_type, status, issue_date, expiry_date, is_valid)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminUserIds[0], 'DBS001234567890', 'ENHANCED', 'VALID', '2024-03-15', '2027-03-15', true],
      ),
      dataSource.query(
        `INSERT INTO dbs_checks (user_id, certificate_number, check_type, status, issue_date, expiry_date, is_valid)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminUserIds[1], 'DBS001234567891', 'ENHANCED', 'VALID', '2024-05-20', '2027-05-20', true],
      ),
    ]);
    console.log(`Created ${dbsChecks.length} DBS checks\n`);

    // Seed Consents for all swimmers
    console.log('Creating consent records...');
    let consentCount = 0;

    for (let i = 0; i < swimmerIds.length; i++) {
      const swimmerId = swimmerIds[i];
      const familySwimmer = swimmerData[i];
      const familyIndex = familyIds.indexOf(familySwimmer[0]);
      const parentUserId = parentUsers[familyIndex][0].user_id;

      // Medical treatment consent (everyone granted)
      await dataSource.query(
        `INSERT INTO consents (swimmer_id, consent_type, status, granted_by_user_id, granted_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [swimmerId, 'MEDICAL_TREATMENT', 'GRANTED', parentUserId, '2025-09-01'],
      );

      // Photography consent (90% granted, 10% denied)
      const photoStatus = Math.random() > 0.1 ? 'GRANTED' : 'DENIED';
      await dataSource.query(
        `INSERT INTO consents (swimmer_id, consent_type, status, granted_by_user_id, granted_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [swimmerId, 'PHOTOGRAPHY', photoStatus, parentUserId, '2025-09-01'],
      );

      // Data sharing consent (95% granted)
      const dataStatus = Math.random() > 0.05 ? 'GRANTED' : 'DENIED';
      await dataSource.query(
        `INSERT INTO consents (swimmer_id, consent_type, status, granted_by_user_id, granted_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [swimmerId, 'DATA_SHARING', dataStatus, parentUserId, '2025-09-01'],
      );

      consentCount += 3;
    }
    console.log(`Created ${consentCount} consent records\n`);

    // Seed Communications
    console.log('Creating communications...');
    const communications = await Promise.all([
      // Club-wide announcements
      dataSource.query(`
        INSERT INTO communications (subject, body, recipient_type, squad_id, family_id, recipient_count, sent_date)
        VALUES (
          'Welcome to the 2025/26 Season',
          'Welcome back to RTW Monson Swimming Club! We are delighted to start the new season with such a fantastic group of swimmers. Training schedules have been sent to your email addresses. Please ensure all membership fees are paid by the end of September.',
          'all', NULL, NULL, ${familyIds.length},
          '2025-09-01 10:00:00'
        )
      `),
      dataSource.query(`
        INSERT INTO communications (subject, body, recipient_type, squad_id, family_id, recipient_count, sent_date)
        VALUES (
          'Pool Closure - 25th December',
          'Please note that Monson Pool will be closed on Christmas Day and Boxing Day. All sessions on these dates are cancelled. Training resumes on 27th December.',
          'all', NULL, NULL, ${familyIds.length},
          '2025-12-15 09:00:00'
        )
      `),
      dataSource.query(`
        INSERT INTO communications (subject, body, recipient_type, squad_id, family_id, recipient_count, sent_date)
        VALUES (
          'Gala Entries Now Open',
          'Entries are now open for the Kent County Championships taking place in February 2026. Qualifying times apply. Please speak to your coach if you would like to enter.',
          'all', NULL, NULL, ${familyIds.length},
          '2025-11-20 14:30:00'
        )
      `),
      dataSource.query(`
        INSERT INTO communications (subject, body, recipient_type, squad_id, family_id, recipient_count, sent_date)
        VALUES (
          'Christmas Break Schedule',
          'During the Christmas break, some sessions will operate on reduced schedules. Please check the website for full details. We wish all our members a wonderful festive season.',
          'all', NULL, NULL, ${familyIds.length},
          '2025-12-18 16:00:00'
        )
      `),

      // Squad-specific messages
      dataSource.query(`
        INSERT INTO communications (subject, body, recipient_type, squad_id, family_id, recipient_count, sent_date)
        VALUES (
          'Junior Competition Squad - Extra Session',
          'An additional training session has been scheduled for Saturday 7th December at 14:00 to prepare for the upcoming county championships. Attendance is strongly encouraged for all competitive swimmers.',
          'squad', '${squadIds[2]}', NULL, 8,
          '2025-11-28 11:00:00'
        )
      `),
      dataSource.query(`
        INSERT INTO communications (subject, body, recipient_type, squad_id, family_id, recipient_count, sent_date)
        VALUES (
          'Water Polo Match This Sunday',
          'Reminder: We have a friendly water polo match this Sunday at 10:00 at TW Sports Centre. Please arrive 15 minutes early for warm-up. Spectators welcome!',
          'squad', '${squadIds[5]}', NULL, 8,
          '2025-11-06 18:00:00'
        )
      `),

      // Family-specific message
      dataSource.query(`
        INSERT INTO communications (subject, body, recipient_type, squad_id, family_id, recipient_count, sent_date)
        VALUES (
          'Outstanding Invoice Reminder',
          'This is a friendly reminder that invoice INV-2025-11-004 is now overdue. Please arrange payment at your earliest convenience to avoid any disruption to swimming sessions.',
          'family', NULL, '${familyIds[3]}', 1,
          '2025-12-10 09:30:00'
        )
      `),
    ]);
    console.log(`Created ${communications.length} communications\n`);

    // Final summary
    console.log('\n===========================================');
    console.log('SEED DATA CREATION COMPLETE');
    console.log('===========================================');
    console.log(`Club: RTW Monson Swimming Club`);
    console.log(`Families: ${families.length}`);
    console.log(`Swimmers: ${swimmers.length}`);
    console.log(`Squads: ${squads.length}`);
    console.log(`Users: ${adminUsers.length} admin, ${parentUsers.length} parents`);
    console.log(`Sessions: ${sessions.length} (Oct-Dec 2025)`);
    console.log(`Attendance records: ${attendanceCount}`);
    console.log(`Fee structures: ${feeStructures.length}`);
    console.log(`Invoices: ${invoices.length}`);
    console.log(`Direct Debit mandates: ${mandates.length}`);
    console.log(`DBS checks: ${dbsChecks.length}`);
    console.log(`Consent records: ${consentCount}`);
    console.log(`Communications: ${communications.length}`);
    console.log('===========================================\n');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seed();
