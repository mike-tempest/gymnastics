import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the row-level security backstop from
 * 1744203700000-EnableRowLevelSecurity to the award tables.
 *
 * Same policy, same reasoning: rows are visible and mutable only when the
 * row's club_id matches the app.current_club session setting, and
 * current_setting(..., true) returns NULL rather than erroring when the
 * setting is absent, so a connection with no tenant context sees nothing
 * instead of everything. ENABLE rather than FORCE, so the migration/seed
 * owner role keeps working exactly as it does for every other table.
 */
export class EnableRowLevelSecurityOnAwards1744204050000 implements MigrationInterface {
  private static readonly AWARD_TABLES = [
    'award_schemes',
    'award_levels',
    'member_award_progress',
    'award_assessment_events',
    'award_assessment_outcomes',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of EnableRowLevelSecurityOnAwards1744204050000.AWARD_TABLES) {
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
    for (const table of EnableRowLevelSecurityOnAwards1744204050000.AWARD_TABLES) {
      if (!(await queryRunner.hasTable(table))) {
        continue;
      }
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
