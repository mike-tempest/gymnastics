import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

/**
 * Phase 1 (3/4): Data migration.
 *
 * 1. Create a single "default" club from the existing singleton club_settings
 *    row (name / Swim England affiliation / contact pulled from that row).
 * 2. Stamp every tenant-owned table's club_id with that club:
 *    - "default club" tables get it set directly.
 *    - child tables derive it from their parent FK (denormalised so each table
 *      is independently scopable / RLS-able).
 * 3. Link the club_settings row to the club and add UNIQUE(club_id).
 * 4. Assert no NULL club_id remains anywhere; the next migration sets NOT NULL
 *    and would fail loudly otherwise, so fail here with a clear message.
 *
 * The tenant tables that already carried a nullable club_id (users, swimmers,
 * competitions) are backfilled here too.
 */

// Tenant tables whose club_id is set directly to the default club.
const DEFAULT_CLUB_TABLES = [
  'users',
  'swimmers',
  'competitions',
  'families',
  'squads',
  'sessions',
  'invoices',
  'direct_debit_mandates',
  'fee_structures',
  'communications',
  'audit_logs',
  'dbs_checks',
  'safeguarding_incidents',
  'safeguarding_officers',
  'safeguarding_checklist_items',
  'waitlist',
];

// Every tenant table that must have a non-null club_id after this migration.
const ALL_TENANT_TABLES = [
  ...DEFAULT_CLUB_TABLES,
  'club_settings',
  'family_invites',
  'attendance',
  'invoice_items',
  'payments',
  'consents',
  'competition_entries',
  'competition_results',
  'swimmer_cycle_logs',
  'swimmer_wellbeing_logs',
];

export class BackfillClubIdAndDefaultClub1744200800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the default club from the existing club_settings singleton.
    //    swim_england is a jsonb blob: { region, affiliate_number }.
    //    There is no dedicated county column, so derive it from the existing
    //    settings if present, else leave null.
    const inserted = await queryRunner.query(`
      INSERT INTO clubs (
        name,
        slug,
        swim_england_region,
        swim_england_affiliate_number,
        county,
        contact_email,
        phone,
        website,
        status
      )
      SELECT
        COALESCE(NULLIF(cs.club_name, ''), 'My Swim Club'),
        regexp_replace(
          lower(COALESCE(NULLIF(cs.club_name, ''), 'my-swim-club')),
          '[^a-z0-9]+', '-', 'g'
        ),
        cs.swim_england->>'region',
        cs.swim_england->>'affiliate_number',
        cs.swim_england->>'county',
        cs.contact_email,
        cs.phone,
        cs.website,
        'active'
      FROM club_settings cs
      ORDER BY cs.created_at ASC
      LIMIT 1
      RETURNING id;
    `);

    let defaultClubId: string | undefined = inserted?.[0]?.id;

    // Fallback: if there is no club_settings row at all (e.g. an empty DB),
    // create a placeholder club so the constraints migration still has a target.
    if (!defaultClubId) {
      const placeholder = await queryRunner.query(`
        INSERT INTO clubs (name, slug, status)
        VALUES ('My Swim Club', 'my-swim-club', 'active')
        RETURNING id;
      `);
      defaultClubId = placeholder?.[0]?.id;
    }

    if (!defaultClubId) {
      throw new Error('BackfillClubIdAndDefaultClub: failed to create a default club.');
    }

    // 2a. Direct "default club" tables.
    for (const table of DEFAULT_CLUB_TABLES) {
      await queryRunner.query(`UPDATE "${table}" SET club_id = $1 WHERE club_id IS NULL;`, [
        defaultClubId,
      ]);
    }

    // 2b. club_settings -> link the singleton to the club.
    await queryRunner.query(`UPDATE club_settings SET club_id = $1 WHERE club_id IS NULL;`, [
      defaultClubId,
    ]);

    // 2c. Child tables derive club_id from their parent FK.
    // family_invites -> families.club_id
    await queryRunner.query(`
      UPDATE family_invites fi
      SET club_id = f.club_id
      FROM families f
      WHERE fi.family_id = f.family_id AND fi.club_id IS NULL;
    `);

    // attendance -> sessions.club_id
    await queryRunner.query(`
      UPDATE attendance a
      SET club_id = s.club_id
      FROM sessions s
      WHERE a.session_id = s.session_id AND a.club_id IS NULL;
    `);

    // invoice_items -> invoices.club_id
    await queryRunner.query(`
      UPDATE invoice_items ii
      SET club_id = i.club_id
      FROM invoices i
      WHERE ii.invoice_id = i.invoice_id AND ii.club_id IS NULL;
    `);

    // payments -> invoices.club_id
    await queryRunner.query(`
      UPDATE payments p
      SET club_id = i.club_id
      FROM invoices i
      WHERE p.invoice_id = i.invoice_id AND p.club_id IS NULL;
    `);

    // consents -> swimmers.club_id
    await queryRunner.query(`
      UPDATE consents c
      SET club_id = sw.club_id
      FROM swimmers sw
      WHERE c.swimmer_id = sw.swimmer_id AND c.club_id IS NULL;
    `);

    // competition_entries -> competitions.club_id
    await queryRunner.query(`
      UPDATE competition_entries ce
      SET club_id = comp.club_id
      FROM competitions comp
      WHERE ce.competition_id = comp.competition_id AND ce.club_id IS NULL;
    `);

    // competition_results -> competitions.club_id
    await queryRunner.query(`
      UPDATE competition_results cr
      SET club_id = comp.club_id
      FROM competitions comp
      WHERE cr.competition_id = comp.competition_id AND cr.club_id IS NULL;
    `);

    // swimmer_cycle_logs -> swimmers.club_id
    await queryRunner.query(`
      UPDATE swimmer_cycle_logs scl
      SET club_id = sw.club_id
      FROM swimmers sw
      WHERE scl.swimmer_id = sw.swimmer_id AND scl.club_id IS NULL;
    `);

    // swimmer_wellbeing_logs -> swimmers.club_id
    await queryRunner.query(`
      UPDATE swimmer_wellbeing_logs swl
      SET club_id = sw.club_id
      FROM swimmers sw
      WHERE swl.swimmer_id = sw.swimmer_id AND swl.club_id IS NULL;
    `);

    // 3. UNIQUE(club_id) on club_settings (one settings row per club).
    await queryRunner.createUniqueConstraint(
      'club_settings',
      new TableUnique({
        name: 'UQ_CLUB_SETTINGS_CLUB_ID',
        columnNames: ['club_id'],
      }),
    );

    // 4. Assert no NULLs remain on any tenant table.
    for (const table of ALL_TENANT_TABLES) {
      const result = await queryRunner.query(
        `SELECT COUNT(*)::int AS n FROM "${table}" WHERE club_id IS NULL;`,
      );
      const remaining = result?.[0]?.n ?? 0;
      if (remaining > 0) {
        throw new Error(
          `BackfillClubIdAndDefaultClub: ${remaining} row(s) in "${table}" still have NULL club_id after backfill.`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint added on club_settings.
    await queryRunner.dropUniqueConstraint('club_settings', 'UQ_CLUB_SETTINGS_CLUB_ID');

    // Null out the backfilled club_id values so the column-drop migration
    // returns to a clean prior state.
    for (const table of ALL_TENANT_TABLES) {
      await queryRunner.query(`UPDATE "${table}" SET club_id = NULL;`);
    }

    // Remove the default club(s) created by this migration.
    await queryRunner.query(`DELETE FROM clubs;`);
  }
}
