import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FamiliesService } from '../src/modules/families/families.service';
import { MembersService } from '../src/modules/members/members.service';
import { SquadsService } from '../src/modules/squads/squads.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { UsersService } from '../src/modules/users/users.service';
import { DBSService } from '../src/modules/compliance/dbs/dbs.service';
import { ConsentsService } from '../src/modules/compliance/consents/consents.service';

async function seedTestData() {
  console.log('🌱 Starting test data seeding...\n');

  const app = await NestFactory.createApplicationContext(AppModule);

  const familiesService = app.get(FamiliesService);
  const membersService = app.get(MembersService);
  const squadsService = app.get(SquadsService);
  const sessionsService = app.get(SessionsService);
  const usersService = app.get(UsersService);
  const dbsService = app.get(DBSService);
  const consentsService = app.get(ConsentsService);

  try {
    // 1. Create test families
    console.log('📋 Creating families...');
    const family1 = await familiesService.create({
      family_name: 'Smith Family',
      primary_contact_name: 'Sarah Smith',
      primary_contact_email: 'sarah.smith@test.com',
      primary_contact_phone: '07700 900123',
      address_line1: '123 Main Street',
      city: 'London',
      postcode: 'SW1A 1AA',
    });

    const family2 = await familiesService.create({
      family_name: 'Johnson Family',
      primary_contact_name: 'Michael Johnson',
      primary_contact_email: 'michael.johnson@test.com',
      primary_contact_phone: '07700 900456',
      address_line1: '456 Oak Avenue',
      city: 'Manchester',
      postcode: 'M1 1AE',
    });

    console.log(`✅ Created ${family1.family_name} and ${family2.family_name}\n`);

    // 2. Create test squads
    console.log('Creating squads...');
    const squad1 = await squadsService.create({
      squad_name: 'Junior Squad',
      description: 'Ages 8-12',
      min_age: 8,
      max_age: 12,
      coach_name: 'Coach Emma Williams',
      training_times: 'Monday & Wednesday 5:30-6:30pm',
      max_capacity: 20,
    });

    const squad2 = await squadsService.create({
      squad_name: 'Senior Squad',
      description: 'Ages 13-18',
      min_age: 13,
      max_age: 18,
      coach_name: 'Coach David Brown',
      training_times: 'Tuesday & Thursday 6:00-7:30pm',
      max_capacity: 16,
    });

    console.log(`✅ Created ${squad1.squad_name} and ${squad2.squad_name}\n`);

    // 3. Create test members
    console.log('Creating members...');
    const member1 = await membersService.create({
      family_id: family1.family_id,
      first_name: 'Emily',
      last_name: 'Smith',
      dob: '2013-05-15',
      gender: 'Female',
      registration_number: 'SE123456',
      medical_notes: 'No known allergies',
    });

    const member2 = await membersService.create({
      family_id: family1.family_id,
      first_name: 'James',
      last_name: 'Smith',
      dob: '2015-09-22',
      gender: 'Male',
      registration_number: 'SE123457',
    });

    const member3 = await membersService.create({
      family_id: family2.family_id,
      first_name: 'Olivia',
      last_name: 'Johnson',
      dob: '2011-03-10',
      gender: 'Female',
      registration_number: 'SE123458',
    });

    console.log(`✅ Created members: Emily, James, and Olivia\n`);

    // 4. Add members to squads
    console.log('🔗 Adding members to squads...');
    await squadsService.addMember(squad1.squad_id, member1.member_id);
    await squadsService.addMember(squad1.squad_id, member2.member_id);
    await squadsService.addMember(squad2.squad_id, member3.member_id);
    console.log('✅ Members assigned to squads\n');

    // 5. Create sessions for TOMORROW (so reminder emails will trigger)
    console.log('📅 Creating sessions for tomorrow...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const session1 = await sessionsService.create({
      squad_id: squad1.squad_id,
      session_name: 'Junior Training',
      session_date: tomorrowStr,
      start_time: '17:30',
      end_time: '18:30',
      location: 'Riverside Leisure Centre',
      coach_name: 'Coach Emma Williams',
      description: 'Focus on freestyle technique and endurance',
      max_participants: 20,
      status: 'scheduled' as any,
    });

    const session2 = await sessionsService.create({
      squad_id: squad2.squad_id,
      session_name: 'Senior Training',
      session_date: tomorrowStr,
      start_time: '18:00',
      end_time: '19:30',
      location: 'Riverside Leisure Centre',
      coach_name: 'Coach David Brown',
      description: 'Sprint training and race preparation',
      max_participants: 16,
      status: 'scheduled' as any,
    });

    console.log(`✅ Created sessions for ${tomorrowStr}\n`);

    // 6. Create test users with DBS records
    console.log('👤 Creating users and DBS records...');

    const user1 = await usersService.create({
      email: 'coach.emma@swimclub.com',
      password: 'password123',
      first_name: 'Emma',
      last_name: 'Williams',
      role: 'coach',
    });

    // DBS expiring in 25 days (should trigger warning)
    const expiryDate25Days = new Date();
    expiryDate25Days.setDate(expiryDate25Days.getDate() + 25);

    await dbsService.create({
      user_id: user1.user_id,
      certificate_number: 'DBS001234567',
      check_type: 'Enhanced',
      issue_date: '2022-01-15',
      expiry_date: expiryDate25Days.toISOString().split('T')[0],
      status: 'valid',
    });

    const user2 = await usersService.create({
      email: 'coach.david@swimclub.com',
      password: 'password123',
      first_name: 'David',
      last_name: 'Brown',
      role: 'coach',
    });

    // DBS expiring in 5 days (should trigger urgent warning)
    const expiryDate5Days = new Date();
    expiryDate5Days.setDate(expiryDate5Days.getDate() + 5);

    await dbsService.create({
      user_id: user2.user_id,
      certificate_number: 'DBS001234568',
      check_type: 'Enhanced',
      issue_date: '2022-02-20',
      expiry_date: expiryDate5Days.toISOString().split('T')[0],
      status: 'valid',
    });

    console.log('✅ Created coaches with DBS records\n');

    // 7. Create test consents (some expiring soon)
    console.log('📝 Creating consent records...');

    // Consent expiring in 20 days
    const consentExpiry20Days = new Date();
    consentExpiry20Days.setDate(consentExpiry20Days.getDate() + 20);

    await consentsService.create({
      member_id: member1.member_id,
      consent_type: 'photography',
      granted_by: 'Sarah Smith',
      granted_date: '2024-01-15',
      expiry_date: consentExpiry20Days.toISOString().split('T')[0],
      status: 'active',
    });

    // Consent expiring in 10 days
    const consentExpiry10Days = new Date();
    consentExpiry10Days.setDate(consentExpiry10Days.getDate() + 10);

    await consentsService.create({
      member_id: member2.member_id,
      consent_type: 'medical',
      granted_by: 'Sarah Smith',
      granted_date: '2024-02-01',
      expiry_date: consentExpiry10Days.toISOString().split('T')[0],
      status: 'active',
    });

    await consentsService.create({
      member_id: member3.member_id,
      consent_type: 'photography',
      granted_by: 'Michael Johnson',
      granted_date: '2024-01-20',
      expiry_date: consentExpiry10Days.toISOString().split('T')[0],
      status: 'active',
    });

    console.log('✅ Created consent records\n');

    console.log('✨ Test data seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log('  - 2 families created');
    console.log('  - 3 members created');
    console.log('  - 2 squads created');
    console.log(`  - 2 sessions created for ${tomorrowStr}`);
    console.log('  - 2 coaches with DBS records (expiring soon)');
    console.log('  - 3 consent records (expiring soon)');
    console.log('\n🧪 Ready to test email integrations!');
    console.log('📧 Test emails:');
    console.log('  - sarah.smith@test.com (will receive session reminders)');
    console.log('  - michael.johnson@test.com (will receive session reminders)');
    console.log('  - coach.emma@swimclub.com (will receive DBS warnings)');
    console.log('  - coach.david@swimclub.com (will receive DBS warnings)');
    console.log('\n🔗 Testing endpoints:');
    console.log('  GET  http://localhost:3001/api/testing/info');
    console.log('  POST http://localhost:3001/api/testing/trigger-session-reminders');
    console.log('  POST http://localhost:3001/api/testing/trigger-dbs-reminders');
    console.log('  POST http://localhost:3001/api/testing/trigger-consent-reminders');
    console.log('\n📬 MailHog: http://localhost:8025');
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seedTestData();
