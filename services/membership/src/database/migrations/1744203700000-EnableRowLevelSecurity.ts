import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Postgres row-level security backstop for tenant isolation, per
 * docs/multi-tenancy/03-enforcement.md ("Defense in depth", do last).
 *
 * Every tenant table gets RLS enabled with a single policy: rows are visible
 * and mutable only when the row's club_id matches the app.current_club
 * session setting. current_setting(..., true) returns NULL instead of
 * erroring when the setting is absent, and `club_id = NULL` is never true,
 * so a connection with no tenant context sees NOTHING rather than everything.
 * The clubs table itself is scoped on its primary key.
 *
 * Deliberately ENABLE, not FORCE: the table owner (the role that runs
 * migrations, seeds and today's application connection) bypasses non-forced
 * RLS. That keeps every existing code path working unchanged, including the
 * cron jobs that legitimately sweep across clubs (session reminders,
 * activation emails, payment collection). The backstop becomes active for
 * any non-owner connection immediately, and for the application itself as
 * soon as it connects with a least-privilege role. See
 * docs/multi-tenancy/06-rls-backstop.md for the verification procedure and
 * the follow-up to move the app off the owner role.
 */
export class EnableRowLevelSecurity1744203700000 implements MigrationInterface {
  /** Tenant tables carrying a club_id column at the time of this migration. */
  private static readonly CLUB_ID_TABLES = [
    'attendance',
    'audit_logs',
    'club_payment_connections',
    'club_settings',
    'communications',
    'competition_entries',
    'competition_results',
    'competitions',
    'consents',
    'dbs_checks',
    'direct_debit_mandates',
    'families',
    'family_invites',
    'fee_structures',
    'invoice_items',
    'invoices',
    'payments',
    'personal_bests',
    'safeguarding_checklist_items',
    'safeguarding_incidents',
    'safeguarding_officers',
    'sessions',
    'squads',
    'swimmer_cycle_logs',
    'swimmer_wellbeing_logs',
    'swimmers',
    'users',
    'waitlist',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of EnableRowLevelSecurity1744203700000.CLUB_ID_TABLES) {
      // Guard on actual schema state so the migration stays safe if a table
      // was renamed or a column diverges between environments.
      const hasTable = await queryRunner.hasTable(table);
      if (!hasTable) {
        continue;
      }
      const hasClubId = await queryRunner.hasColumn(table, 'club_id');
      if (!hasClubId) {
        continue;
      }

      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`);
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table}"
         USING (club_id = current_setting('app.current_club', true)::uuid)
         WITH CHECK (club_id = current_setting('app.current_club', true)::uuid)`,
      );
    }

    // The clubs table is the tenant root: scope it on its primary key.
    if (await queryRunner.hasTable('clubs')) {
      await queryRunner.query(`ALTER TABLE "clubs" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON "clubs"`);
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "clubs"
         USING (id = current_setting('app.current_club', true)::uuid)
         WITH CHECK (id = current_setting('app.current_club', true)::uuid)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allTables = [...EnableRowLevelSecurity1744203700000.CLUB_ID_TABLES, 'clubs'];
    for (const table of allTables) {
      const hasTable = await queryRunner.hasTable(table);
      if (!hasTable) {
        continue;
      }
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
