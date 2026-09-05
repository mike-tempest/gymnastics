const nodemailer = require('nodemailer');
const { Client } = require('pg');

async function sendTestEmail() {
  // Connect to database
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'swim_nexus_dev',
  });

  await client.connect();
  console.log('Connected to database');

  // Get sessions for tomorrow (2025-12-30)
  const result = await client.query(`
    SELECT
      s.session_id,
      s.session_name,
      s.session_date,
      s.start_time,
      s.end_time,
      s.location,
      sq.squad_name,
      array_agg(DISTINCT jsonb_build_object(
        'member_name', sw.first_name || ' ' || sw.last_name,
        'family_email', f.primary_contact_email,
        'family_name', f.family_name
      )) as families
    FROM sessions s
    LEFT JOIN squads sq ON s.squad_id = sq.squad_id
    LEFT JOIN squad_members ss ON sq.squad_id = ss.squad_id
    LEFT JOIN members sw ON ss.member_id = sw.member_id
    LEFT JOIN families f ON sw.family_id = f.family_id
    WHERE s.session_date = '2025-12-30'
      AND s.status = 'scheduled'
    GROUP BY s.session_id, s.session_name, s.session_date, s.start_time, s.end_time, s.location, sq.squad_name
  `);

  console.log(`Found ${result.rows.length} sessions`);
  console.log(JSON.stringify(result.rows, null, 2));

  // Create mail transporter (using MailHog)
  const transporter = nodemailer.createTransport({
    host: 'localhost',
    port: 1025,
    ignoreTLS: true,
  });

  // Send emails for each session
  for (const session of result.rows) {
    const families = session.families.filter(f => f.family_email);
    const uniqueFamilies = [...new Map(families.map(f => [f.family_email, f])).values()];

    console.log(`\nSession: ${session.session_name}`);
    console.log(`Sending to ${uniqueFamilies.length} families`);

    for (const family of uniqueFamilies) {
      if (!family.family_email) continue;

      const mailOptions = {
        from: '"Swim Club" <noreply@swimclub.com>',
        to: family.family_email,
        subject: `Session Reminder: ${session.session_name} - Tomorrow`,
        html: `
          <h2>Swimming Session Reminder</h2>
          <p>Hi ${family.family_name},</p>
          <p>This is a reminder that there is a session tomorrow:</p>
          <ul>
            <li><strong>Session:</strong> ${session.session_name}</li>
            <li><strong>Squad:</strong> ${session.squad_name || 'N/A'}</li>
            <li><strong>Date:</strong> ${session.session_date}</li>
            <li><strong>Time:</strong> ${session.start_time} - ${session.end_time}</li>
            <li><strong>Location:</strong> ${session.location || 'Pool'}</li>
          </ul>
          <p>Please make sure your member is ready!</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ Email sent to ${family.family_email}`);
      } catch (error) {
        console.error(`✗ Failed to send to ${family.family_email}:`, error.message);
      }
    }
  }

  await client.end();
  console.log('\n✅ Done! Check MailHog at http://localhost:8025');
}

sendTestEmail().catch(console.error);
