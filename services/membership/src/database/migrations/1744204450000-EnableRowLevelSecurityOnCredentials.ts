import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the row-level security backstop from
 * 1744203700000-EnableRowLevelSecurity to the credentials table (TEM-30).
 *
 * That migration enumerates the tables that existed when it was written, so a
 * new table is never picked up retroactively and needs its own policy.
 *
 * Same policy, same reasoning: rows are visible and mutable only when the
 * row's club_id matches the app.current_club session setting, and
 * current_setting(..., true) returns NULL rather than erroring when the
 * setting is absent, so a connection with no tenant context sees nothing
 * instead of everything. ENABLE rather than FORCE, so the migration and seed
 * owner role keeps working exactly as it does for every other table.
 */
export class EnableRowLevelSecurityOnCredentials1744204450000 implements MigrationInterface {
  private static readonly TABLE = 'compliance_credentials';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = EnableRowLevelSecurityOnCredentials1744204450000.TABLE;
    // Guard on actual schema state, matching the original RLS migration.
    if (!(await queryRunner.hasTable(table))) {
      return;
    }
    if (!(await queryRunner.hasColumn(table, 'club_id'))) {
      return;
    }

    await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`);
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "${table}"
       USING (club_id = current_setting('app.current_club', true)::uuid)
       WITH CHECK (club_id = current_setting('app.current_club', true)::uuid)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = EnableRowLevelSecurityOnCredentials1744204450000.TABLE;
    if (!(await queryRunner.hasTable(table))) {
      return;
    }
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`);
    await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
  }
}
