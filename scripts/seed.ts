import 'reflect-metadata';
import { config } from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { Family } from '../services/membership/src/modules/families/entities/family.entity';
import { Swimmer } from '../services/membership/src/modules/swimmers/entities/swimmer.entity';
import { Squad } from '../services/membership/src/modules/squads/entities/squad.entity';
import { Session } from '../services/membership/src/modules/sessions/entities/session.entity';
import { FeeStructure, FeeFrequency, AppliesToType } from '../services/membership/src/modules/finance/fee-structures/entities/fee-structure.entity';
import { Invoice, InvoiceStatus } from '../services/membership/src/modules/finance/invoices/entities/invoice.entity';
import { InvoiceItem } from '../services/membership/src/modules/finance/invoices/entities/invoice-item.entity';

// Load environment variables from .env.seed
config({ path: path.join(__dirname, '..', '.env.seed') });

faker.locale = 'en_GB';

const clubId = 'c0a80121-0000-0000-0000-000000000001';

// Tunbridge Wells street names and postcodes
const twStreets = [
  'Mount Pleasant Road', 'London Road', 'Camden Road', 'Calverley Road',
  'St Johns Road', 'Frant Road', 'Pembury Road', 'High Street',
  'Grove Hill Road', 'Warwick Park', 'Hungershall Park', 'Molyneux Park Road',
  'Nevill Street', 'Church Road', 'Vale Road', 'Broadwater Down',
  'Bishops Down', 'Sandhurst Road', 'Ferndale', 'Lansdowne Road',
  'Madeira Park', 'Cumberland Walk', 'Crescent Road', 'Major Yorks Road',
  'Rusthall Road', 'Speldhurst Road', 'Langton Road', 'Bayham Road',
  'Upper Grosvenor Road', 'Lower Green Road', 'Forest Road', 'Quarry Road',
];

const twPostcodes = [
  'TN1 1AA', 'TN1 1AB', 'TN1 1DA', 'TN1 1JP', 'TN1 1QE', 'TN1 1RN',
  'TN1 2LR', 'TN1 2PT', 'TN1 2QP', 'TN1 2RA', 'TN1 2SG', 'TN1 2TH',
  'TN2 3AA', 'TN2 3HE', 'TN2 3NS', 'TN2 3QY', 'TN2 3UJ', 'TN2 4AA',
  'TN2 4DB', 'TN2 5AA', 'TN2 5NR', 'TN2 5TD', 'TN2 5XA',
  'TN3 0AA', 'TN3 0JD', 'TN3 0RP', 'TN3 9AA',
  'TN4 0AA', 'TN4 0PB', 'TN4 8AA', 'TN4 8HJ', 'TN4 9AA',
];

// Squad distribution targets
const squadConfig = [
  { name: 'Learn to Swim', minAge: 4, maxAge: 7, coach: 'Emma Wilson', times: 'Mon/Wed 16:30-17:15', targetSwimmers: 25, fee: 35 },
  { name: 'Development', minAge: 7, maxAge: 10, coach: 'Sarah Mitchell', times: 'Mon/Wed/Fri 17:30-18:30', targetSwimmers: 30, fee: 45 },
  { name: 'Junior Competition', minAge: 10, maxAge: 13, coach: 'James Cooper', times: 'Mon/Wed/Fri 18:00-19:30, Sat 08:30-10:00', targetSwimmers: 25, fee: 55 },
  { name: 'Senior Competition', minAge: 13, maxAge: 17, coach: 'David Hughes', times: 'Mon/Wed/Fri 18:30-20:00, Sat 09:00-11:00', targetSwimmers: 20, fee: 65 },
  { name: 'Masters', minAge: 18, maxAge: null, coach: 'Lisa Turner', times: 'Tue/Thu 19:00-20:30, Sat 10:00-11:30', targetSwimmers: 15, fee: 55 },
  { name: 'Water Polo', minAge: 12, maxAge: null, coach: 'Tom Richards', times: 'Tue/Thu 18:00-19:30, Sun 10:00-12:00', targetSwimmers: 15, fee: 50 },
  { name: 'Diving', minAge: 8, maxAge: null, coach: 'Sophie Anderson', times: 'Wed/Sat 17:00-18:30', targetSwimmers: 10, fee: 50 },
  { name: 'Para Swimming', minAge: 8, maxAge: null, coach: 'Rachel Phillips', times: 'Mon/Fri 16:00-17:30, Sat 11:00-12:00', targetSwimmers: 10, fee: 45 },
];

// DBS coaches and volunteers
const dbsRecords = [
  { name: 'Emma Wilson', role: 'Head Coach - Learn to Swim', dbsNumber: 'DBS-001-2024-RTW', issueDate: '2024-03-15', expiryDate: '2027-03-15' },
  { name: 'Sarah Mitchell', role: 'Coach - Development', dbsNumber: 'DBS-002-2024-RTW', issueDate: '2024-05-20', expiryDate: '2027-05-20' },
  { name: 'James Cooper', role: 'Head Coach - Junior Competition', dbsNumber: 'DBS-003-2023-RTW', issueDate: '2023-11-10', expiryDate: '2026-11-10' },
  { name: 'David Hughes', role: 'Head Coach - Senior Competition', dbsNumber: 'DBS-004-2024-RTW', issueDate: '2024-01-08', expiryDate: '2027-01-08' },
  { name: 'Lisa Turner', role: 'Coach - Masters', dbsNumber: 'DBS-005-2024-RTW', issueDate: '2024-07-22', expiryDate: '2027-07-22' },
  { name: 'Tom Richards', role: 'Coach - Water Polo', dbsNumber: 'DBS-006-2023-RTW', issueDate: '2023-09-14', expiryDate: '2026-09-14' },
  { name: 'Sophie Anderson', role: 'Coach - Diving', dbsNumber: 'DBS-007-2024-RTW', issueDate: '2024-02-28', expiryDate: '2027-02-28' },
  { name: 'Rachel Phillips', role: 'Coach - Para Swimming', dbsNumber: 'DBS-008-2024-RTW', issueDate: '2024-04-05', expiryDate: '2027-04-05' },
  { name: 'Mark Thompson', role: 'Volunteer - Poolside Helper', dbsNumber: 'DBS-009-2024-RTW', issueDate: '2024-06-12', expiryDate: '2027-06-12' },
  { name: 'Claire Robinson', role: 'Volunteer - Timekeeper', dbsNumber: 'DBS-010-2023-RTW', issueDate: '2023-08-30', expiryDate: '2026-08-30' },
  { name: 'Paul Harrison', role: 'Assistant Coach - Senior', dbsNumber: 'DBS-011-2024-RTW', issueDate: '2024-09-18', expiryDate: '2027-09-18' },
  { name: 'Karen White', role: 'Welfare Officer', dbsNumber: 'DBS-012-2023-RTW', issueDate: '2023-12-01', expiryDate: '2026-12-01' },
];

function randomTWAddress() {
  const street = twStreets[Math.floor(Math.random() * twStreets.length)];
  const houseNum = Math.floor(Math.random() * 120) + 1;
  const postcode = twPostcodes[Math.floor(Math.random() * twPostcodes.length)];
  return { line1: `${houseNum} ${street}`, city: 'Royal Tunbridge Wells', postcode };
}

function randomAge(min: number, max: number | null): number {
  const effectiveMax = max ?? 65;
  return Math.floor(Math.random() * (effectiveMax - min + 1)) + min;
}

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'swimteam',
    entities: [Family, Swimmer, Squad, Session, FeeStructure, Invoice, InvoiceItem],
    synchronize: false,
  });

  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('Connected to database');

    // Clear existing data
    console.log('\nClearing existing data...');
    await dataSource.query('DELETE FROM invoice_items');
    await dataSource.query('DELETE FROM invoices');
    await dataSource.query('DELETE FROM attendance');
    await dataSource.query('DELETE FROM sessions');
    await dataSource.query('DELETE FROM squad_swimmers');
    await dataSource.query('DELETE FROM swimmers');
    await dataSource.query('DELETE FROM squads');
    await dataSource.query('DELETE FROM fee_structures');
    await dataSource.query('DELETE FROM families');
    await dataSource.query('DELETE FROM dbs_checks');
    console.log('Cleared existing data');

    // ── SQUADS ──────────────────────────────────────────────────────────
    console.log('\nCreating squads...');
    const squads: Squad[] = [];
    for (const cfg of squadConfig) {
      const squad = dataSource.getRepository(Squad).create({
        squad_name: cfg.name,
        min_age: cfg.minAge,
        max_age: cfg.maxAge,
        coach_name: cfg.coach,
        training_times: cfg.times,
        max_capacity: cfg.name === 'Learn to Swim' ? 30 : cfg.name === 'Masters' ? 25 : 20,
        description: `${cfg.name} squad at RTW Monson Swimming Club`,
      });
      await dataSource.getRepository(Squad).save(squad);
      squads.push(squad);
      console.log(`  ${squad.squad_name}`);
    }

    // ── FEE STRUCTURES ──────────────────────────────────────────────────
    console.log('\nCreating fee structures...');
    const feeStructures: FeeStructure[] = [];
    for (let i = 0; i < squadConfig.length; i++) {
      const cfg = squadConfig[i];
      const fs = dataSource.getRepository(FeeStructure).create({
        name: `${cfg.name} Monthly Fee`,
        description: `Monthly training fee for ${cfg.name} squad`,
        amount: cfg.fee.toFixed(2),
        frequency: FeeFrequency.MONTHLY,
        applies_to_type: AppliesToType.SQUAD,
        applies_to_id: squads[i].squad_id,
        active: true,
      });
      await dataSource.getRepository(FeeStructure).save(fs);
      feeStructures.push(fs);
      console.log(`  ${fs.name} - £${fs.amount}`);
    }

    // ── FAMILIES (80) ───────────────────────────────────────────────────
    console.log('\nCreating 80 families...');
    const families: Family[] = [];
    for (let i = 0; i < 80; i++) {
      const surname = faker.person.lastName();
      const parentFirst = faker.person.firstName();
      const addr = randomTWAddress();
      const family = dataSource.getRepository(Family).create({
        family_name: surname,
        primary_contact_name: `${parentFirst} ${surname}`,
        primary_contact_email: `${parentFirst.toLowerCase()}.${surname.toLowerCase()}@${faker.helpers.arrayElement(['gmail.com', 'outlook.com', 'yahoo.co.uk', 'hotmail.co.uk', 'icloud.com'])}`,
        primary_contact_phone: `07${faker.string.numeric(9)}`,
        address_line1: addr.line1,
        address_line2: null,
        city: addr.city,
        postcode: addr.postcode,
      });
      await dataSource.getRepository(Family).save(family);
      families.push(family);
      if ((i + 1) % 20 === 0) console.log(`  ${i + 1} families created`);
    }
    console.log(`  ${families.length} families total`);

    // ── SWIMMERS (150) ──────────────────────────────────────────────────
    console.log('\nCreating 150 swimmers...');
    const swimmers: Swimmer[] = [];
    let swimmerCount = 0;
    let familyIdx = 0;

    for (let si = 0; si < squadConfig.length; si++) {
      const cfg = squadConfig[si];
      const squad = squads[si];
      let created = 0;

      while (created < cfg.targetSwimmers) {
        const family = families[familyIdx % families.length];
        const age = randomAge(cfg.minAge, cfg.maxAge);
        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - age);
        dob.setMonth(Math.floor(Math.random() * 12));
        dob.setDate(Math.floor(Math.random() * 28) + 1);

        const gender = Math.random() > 0.5 ? 'Male' : 'Female';
        const firstName = gender === 'Male' ? faker.person.firstName('male') : faker.person.firstName('female');

        const swimmer = dataSource.getRepository(Swimmer).create({
          family_id: family.family_id,
          club_id: clubId,
          first_name: firstName,
          last_name: family.family_name,
          dob,
          gender,
          squad_id: squad.squad_id,
          se_number: `SE-${(1000000 + swimmerCount).toString()}`,
          medical_notes: Math.random() < 0.1 ? faker.helpers.arrayElement([
            'Mild asthma, uses inhaler before sessions',
            'Allergy to plasters',
            'Verruca, wears swim socks',
            'Epilepsy, controlled with medication',
            'Eczema, sensitive to chlorine',
          ]) : null,
          photo_url: null,
        });
        await dataSource.getRepository(Swimmer).save(swimmer);

        await dataSource.query(
          'INSERT INTO squad_swimmers (squad_id, swimmer_id) VALUES ($1, $2)',
          [squad.squad_id, swimmer.swimmer_id]
        );

        swimmers.push(swimmer);
        swimmerCount++;
        created++;
        familyIdx++;
      }
      console.log(`  ${cfg.name}: ${created} swimmers`);
    }
    console.log(`  ${swimmers.length} swimmers total`);

    // ── SESSIONS (3 months back + 1 month forward) ──────────────────────
    console.log('\nCreating sessions (3 months history + 1 month forward)...');
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 3);
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    interface SessionRecord { id: string; squadIdx: number; date: Date; }
    const allSessions: SessionRecord[] = [];

    // Session schedule per squad (day of week: 0=Sun, 1=Mon ... 6=Sat)
    const schedules: { squadIdx: number; dayOfWeek: number; startTime: string; endTime: string }[] = [
      // Learn to Swim: Mon/Wed 16:30-17:15
      { squadIdx: 0, dayOfWeek: 1, startTime: '16:30', endTime: '17:15' },
      { squadIdx: 0, dayOfWeek: 3, startTime: '16:30', endTime: '17:15' },
      // Development: Mon/Wed/Fri 17:30-18:30
      { squadIdx: 1, dayOfWeek: 1, startTime: '17:30', endTime: '18:30' },
      { squadIdx: 1, dayOfWeek: 3, startTime: '17:30', endTime: '18:30' },
      { squadIdx: 1, dayOfWeek: 5, startTime: '17:30', endTime: '18:30' },
      // Junior Competition: Mon/Wed/Fri 18:00-19:30, Sat 08:30-10:00
      { squadIdx: 2, dayOfWeek: 1, startTime: '18:00', endTime: '19:30' },
      { squadIdx: 2, dayOfWeek: 3, startTime: '18:00', endTime: '19:30' },
      { squadIdx: 2, dayOfWeek: 5, startTime: '18:00', endTime: '19:30' },
      { squadIdx: 2, dayOfWeek: 6, startTime: '08:30', endTime: '10:00' },
      // Senior Competition: Mon/Wed/Fri 18:30-20:00, Sat 09:00-11:00
      { squadIdx: 3, dayOfWeek: 1, startTime: '18:30', endTime: '20:00' },
      { squadIdx: 3, dayOfWeek: 3, startTime: '18:30', endTime: '20:00' },
      { squadIdx: 3, dayOfWeek: 5, startTime: '18:30', endTime: '20:00' },
      { squadIdx: 3, dayOfWeek: 6, startTime: '09:00', endTime: '11:00' },
      // Masters: Tue/Thu 19:00-20:30, Sat 10:00-11:30
      { squadIdx: 4, dayOfWeek: 2, startTime: '19:00', endTime: '20:30' },
      { squadIdx: 4, dayOfWeek: 4, startTime: '19:00', endTime: '20:30' },
      { squadIdx: 4, dayOfWeek: 6, startTime: '10:00', endTime: '11:30' },
      // Water Polo: Tue/Thu 18:00-19:30, Sun 10:00-12:00
      { squadIdx: 5, dayOfWeek: 2, startTime: '18:00', endTime: '19:30' },
      { squadIdx: 5, dayOfWeek: 4, startTime: '18:00', endTime: '19:30' },
      { squadIdx: 5, dayOfWeek: 0, startTime: '10:00', endTime: '12:00' },
      // Diving: Wed/Sat 17:00-18:30
      { squadIdx: 6, dayOfWeek: 3, startTime: '17:00', endTime: '18:30' },
      { squadIdx: 6, dayOfWeek: 6, startTime: '17:00', endTime: '18:30' },
      // Para Swimming: Mon/Fri 16:00-17:30, Sat 11:00-12:00
      { squadIdx: 7, dayOfWeek: 1, startTime: '16:00', endTime: '17:30' },
      { squadIdx: 7, dayOfWeek: 5, startTime: '16:00', endTime: '17:30' },
      { squadIdx: 7, dayOfWeek: 6, startTime: '11:00', endTime: '12:00' },
    ];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const currentDate = new Date(startDate);
    let sessionCount = 0;
    while (currentDate <= endDate) {
      const dow = currentDate.getDay();
      for (const sched of schedules) {
        if (sched.dayOfWeek !== dow) continue;
        const squad = squads[sched.squadIdx];
        const cfg = squadConfig[sched.squadIdx];

        const session = dataSource.getRepository(Session).create({
          squad_id: squad.squad_id,
          session_name: `${cfg.name} Training - ${dayNames[dow]}`,
          session_date: new Date(currentDate),
          start_time: sched.startTime,
          end_time: sched.endTime,
          location: 'RTW Monson Pool',
          description: `Regular ${cfg.name.toLowerCase()} training session`,
          coach_name: cfg.coach,
          max_participants: squad.max_capacity,
          status: currentDate < now ? 'completed' as any : 'scheduled' as any,
        });
        await dataSource.getRepository(Session).save(session);
        allSessions.push({ id: (session as any).session_id, squadIdx: sched.squadIdx, date: new Date(currentDate) });
        sessionCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    console.log(`  ${sessionCount} sessions created`);

    // ── ATTENDANCE ──────────────────────────────────────────────────────
    console.log('\nCreating attendance records (historical sessions only)...');
    let attendanceCount = 0;
    const historicalSessions = allSessions.filter(s => s.date < now);

    for (const sess of historicalSessions) {
      const squadSwimmers = swimmers.filter(s => s.squad_id === squads[sess.squadIdx].squad_id);
      for (const swimmer of squadSwimmers) {
        // 85% attendance rate
        const present = Math.random() < 0.85;
        if (!present && Math.random() < 0.3) continue; // 30% of absences are just not recorded

        try {
          await dataSource.query(
            `INSERT INTO attendance (session_id, swimmer_id, status, notes, recorded_at) VALUES ($1, $2, $3, $4, $5)`,
            [
              sess.id,
              swimmer.swimmer_id,
              present ? 'present' : faker.helpers.arrayElement(['absent', 'absent', 'excused']),
              present ? null : (Math.random() < 0.3 ? faker.helpers.arrayElement([
                'Unwell', 'Family holiday', 'School event', 'Medical appointment',
                'Competition elsewhere', 'Transport issues',
              ]) : null),
              sess.date,
            ]
          );
          attendanceCount++;
        } catch {
          // Skip if attendance table schema differs
        }
      }
      if (attendanceCount % 1000 === 0 && attendanceCount > 0) {
        console.log(`  ${attendanceCount} attendance records...`);
      }
    }
    console.log(`  ${attendanceCount} attendance records total`);

    // ── DBS CHECKS ──────────────────────────────────────────────────────
    console.log('\nCreating DBS check records...');
    for (const dbs of dbsRecords) {
      try {
        await dataSource.query(
          `INSERT INTO dbs_checks (name, role, dbs_number, issue_date, expiry_date, status, club_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [dbs.name, dbs.role, dbs.dbsNumber, dbs.issueDate, dbs.expiryDate, 'valid', clubId]
        );
        console.log(`  ${dbs.name} - ${dbs.role}`);
      } catch {
        // Skip if dbs_checks table doesn't exist or schema differs
      }
    }

    // ── INVOICES (quarterly for all families) ───────────────────────────
    console.log('\nCreating quarterly invoices...');
    let invoiceCount = 0;
    const quarters = [
      { label: 'Q4 2025', start: new Date(2025, 9, 1), due: new Date(2025, 9, 15), status: 'paid' as InvoiceStatus },
      { label: 'Q1 2026', start: new Date(2026, 0, 1), due: new Date(2026, 0, 15), status: 'paid' as InvoiceStatus },
      { label: 'Q2 2026', start: new Date(2026, 3, 1), due: new Date(2026, 3, 15), status: 'pending' as InvoiceStatus },
    ];

    for (const family of families) {
      const familySwimmers = swimmers.filter(s => s.family_id === family.family_id);
      if (familySwimmers.length === 0) continue;

      for (const q of quarters) {
        // Randomise: 90% paid for Q4, 85% paid for Q1, 20% paid for Q2
        let status = q.status;
        if (q.label === 'Q4 2025') {
          status = Math.random() < 0.9 ? 'paid' : 'overdue';
        } else if (q.label === 'Q1 2026') {
          status = Math.random() < 0.85 ? 'paid' : (Math.random() < 0.5 ? 'overdue' : 'pending');
        } else {
          status = Math.random() < 0.2 ? 'paid' : (Math.random() < 0.6 ? 'pending' : 'overdue');
        }

        const invoice = dataSource.getRepository(Invoice).create({
          family_id: family.family_id,
          invoice_number: `INV-${q.label.replace(' ', '-')}-${(invoiceCount + 1).toString().padStart(4, '0')}`,
          subtotal: '0.00',
          tax_amount: '0.00',
          total_amount: '0.00',
          due_date: q.due,
          issued_date: q.start,
          status: status as InvoiceStatus,
          notes: `${q.label} training fees`,
        });
        await dataSource.getRepository(Invoice).save(invoice);

        let total = 0;
        for (const swimmer of familySwimmers) {
          const squadIdx = squads.findIndex(s => s.squad_id === swimmer.squad_id);
          if (squadIdx === -1) continue;
          const monthlyFee = squadConfig[squadIdx].fee;
          const quarterlyFee = monthlyFee * 3;

          const item = dataSource.getRepository(InvoiceItem).create({
            invoice_id: invoice.invoice_id,
            description: `${squadConfig[squadIdx].name} Squad - ${swimmer.first_name} ${swimmer.last_name} - ${q.label} Training`,
            unit_price: monthlyFee.toFixed(2),
            quantity: 3,
            total: quarterlyFee.toFixed(2),
            fee_structure_id: feeStructures[squadIdx]?.fee_structure_id || null,
          });
          await dataSource.getRepository(InvoiceItem).save(item);
          total += quarterlyFee;
        }

        invoice.subtotal = total.toFixed(2);
        invoice.total_amount = total.toFixed(2);
        await dataSource.getRepository(Invoice).save(invoice);
        invoiceCount++;
      }
    }
    console.log(`  ${invoiceCount} invoices created`);

    // ── SUMMARY ─────────────────────────────────────────────────────────
    console.log('\n========================================');
    console.log('  RTW Monson Swimming Club - Seed Data');
    console.log('========================================');
    console.log(`  Squads:          ${squads.length}`);
    console.log(`  Fee structures:  ${feeStructures.length}`);
    console.log(`  Families:        ${families.length}`);
    console.log(`  Swimmers:        ${swimmers.length}`);
    console.log(`  Sessions:        ${sessionCount}`);
    console.log(`  Attendance:      ${attendanceCount}`);
    console.log(`  DBS checks:      ${dbsRecords.length}`);
    console.log(`  Invoices:        ${invoiceCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

seed();
