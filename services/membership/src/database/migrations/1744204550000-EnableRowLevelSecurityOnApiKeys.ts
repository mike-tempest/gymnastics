import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the row-level security backstop from
 * 1744203700000-EnableRowLevelSecurity to the api_keys table (TEM-32).
 *
 * The original RLS migration enumerated the tables that existed when it ran,
 * so it does not pick up new tables retroactively. Same policy and same
 * reasoning as the awards and waiting-list extensions: rows are visible and
 * mutable only when the row's club_id matches the app.current_club session
 * setting, and current_setting(..., true) yields NULL rather than erroring
 * when the setting is absent, so a connection with no tenant context sees
 * nothing instead of everything. ENABLE rather than FORCE, so the migration
 * and seed owner role keeps working exactly as it does for every other table.
 *
 * This matters more here than elsewhere: api_keys is the table an attacker
 * would most want to read across clubs, so it must not be the one table the
 * backstop misses.
 */
export class EnableRowLevelSecurityOnApiKeys1744204550000 implements MigrationInterface {
  private static readonly TABLE = 'api_keys';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = EnableRowLevelSecurityOnApiKeys1744204550000.TABLE;

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
    const table = EnableRowLevelSecurityOnApiKeys1744204550000.TABLE;

    if (!(await queryRunner.hasTable(table))) {
      return;
    }
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`);
    await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
  }
}
