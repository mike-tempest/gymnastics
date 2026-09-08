import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the row-level security backstop from
 * 1744203700000-EnableRowLevelSecurity to the waiting list tables (TEM-22).
 *
 * Same policy, same reasoning: rows are visible and mutable only when the
 * row's club_id matches the app.current_club session setting, and
 * current_setting(..., true) returns NULL rather than erroring when the
 * setting is absent, so a connection with no tenant context sees nothing
 * instead of everything. ENABLE rather than FORCE, so the migration/seed
 * owner role keeps working exactly as it does for every other table.
 */
export class EnableRowLevelSecurityOnWaitingList1744204250000 implements MigrationInterface {
  private static readonly WAITING_LIST_TABLES = [
    'waiting_list_entries',
    'waiting_list_offers',
    'waiting_list_settings',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of EnableRowLevelSecurityOnWaitingList1744204250000.WAITING_LIST_TABLES) {
      // Guard on actual schema state, matching the original RLS migration.
      if (!(await queryRunner.hasTable(table))) {
        continue;
      }
      if (!(await queryRunner.hasColumn(table, 'club_id'))) {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of EnableRowLevelSecurityOnWaitingList1744204250000.WAITING_LIST_TABLES) {
      if (!(await queryRunner.hasTable(table))) {
        continue;
      }
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
