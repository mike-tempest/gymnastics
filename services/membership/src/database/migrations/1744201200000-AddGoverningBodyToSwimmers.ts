import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Broaden swimmer registration beyond Swim England to all UK home-nation
 * governing bodies (Swim England, Scottish Swimming, Swim Wales, Swim Ireland).
 *
 * - Adds a nullable `governing_body` column recording which body issued the
 *   number held in `se_number` (kept as the storage column).
 * - Backfills existing rows that already carry a number to SWIM_ENGLAND, since
 *   that is the only body the system accepted before this change.
 * - Replaces the global UNIQUE(se_number) with a composite
 *   UNIQUE(governing_body, se_number), so the same numeric string issued by two
 *   different bodies no longer collides (e.g. Swim England 1234567 vs Scottish
 *   Swimming 1234567). NULLs are distinct in Postgres, so swimmers without a
 *   number do not collide with one another.
 */
export class AddGoverningBodyToSwimmers1744201200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('swimmers', 'governing_body');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'swimmers',
        new TableColumn({
          name: 'governing_body',
          type: 'varchar',
          length: '40',
          isNullable: true,
        }),
      );
    }

    // Every existing se_number was a Swim England number.
    await queryRunner.query(
      `UPDATE swimmers SET governing_body = 'SWIM_ENGLAND' WHERE se_number IS NOT NULL AND governing_body IS NULL`,
    );

    // Drop the single-column UNIQUE(se_number) constraint that was created with
    // the table. Its name is auto-generated, so look it up rather than guess.
    await queryRunner.query(`
      DO $$
      DECLARE cname text;
      BEGIN
        SELECT tc.constraint_name INTO cname
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.table_name = 'swimmers'
          AND tc.constraint_type = 'UNIQUE'
          AND ccu.column_name = 'se_number';
        IF cname IS NOT NULL THEN
          EXECUTE format('ALTER TABLE swimmers DROP CONSTRAINT %I', cname);
        END IF;
      END $$;
    `);

    // Also clear a plain unique index on se_number if a previous down() recreated one.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_swimmers_se_number"`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_SWIMMERS_BODY_SE_NUMBER" ON swimmers (governing_body, se_number)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_SWIMMERS_BODY_SE_NUMBER"`);

    // Restore global uniqueness on se_number. This can fail if numbers from
    // different bodies have collided; acceptable for a rarely-used down path.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_swimmers_se_number" ON swimmers (se_number)`,
    );

    const hasColumn = await queryRunner.hasColumn('swimmers', 'governing_body');
    if (hasColumn) {
      await queryRunner.dropColumn('swimmers', 'governing_body');
    }
  }
}
