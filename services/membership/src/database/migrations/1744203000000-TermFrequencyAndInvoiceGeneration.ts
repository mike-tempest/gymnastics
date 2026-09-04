import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Adds the 'term' fee frequency and the invoice columns that make invoice
 * generation idempotent.
 *
 * 1. fee_structures.frequency is converted from a Postgres enum to
 *    varchar(20). Postgres cannot run ALTER TYPE ... ADD VALUE inside a
 *    transaction, and TypeORM wraps every migration in one, so adding 'term'
 *    to the enum directly is not possible. Converting to varchar preserves
 *    every existing value byte-for-byte ('monthly', 'annual', 'one_time'),
 *    keeps the 'monthly' default, and leaves validation to the TypeScript/DTO
 *    layer where the FeeFrequency enum is still enforced. The orphaned enum
 *    type is dropped only if no other column still uses it.
 *    applies_to_type is untouched and remains a Postgres enum.
 *
 * 2. invoices gains fee_structure_id (uuid, NULL) and billing_period
 *    (varchar(20), NULL). Generated invoices record which fee structure and
 *    period they cover, so re-running generation skips families that already
 *    have a non-cancelled invoice for that fee structure and period. Manually
 *    created invoices leave both columns NULL and are unaffected.
 */
export class TermFrequencyAndInvoiceGeneration1744203000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- fee_structures.frequency: enum -> varchar(20) ---------------------
    // Capture the enum type backing the column before converting, so we can
    // drop it afterwards if nothing else still depends on it.
    const typeRows: Array<{ typname: string }> = await queryRunner.query(
      `SELECT t.typname
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_type t ON t.oid = a.atttypid
        WHERE c.relname = 'fee_structures'
          AND a.attname = 'frequency'
          AND t.typtype = 'e'`,
    );
    const enumTypeName = typeRows[0]?.typname;

    await queryRunner.query(`ALTER TABLE "fee_structures" ALTER COLUMN "frequency" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "fee_structures" ALTER COLUMN "frequency" TYPE varchar(20) USING "frequency"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "fee_structures" ALTER COLUMN "frequency" SET DEFAULT 'monthly'`,
    );

    // Drop the now-orphaned enum type, but only when no other column uses it.
    if (enumTypeName) {
      const usage: Array<{ count: string }> = await queryRunner.query(
        `SELECT COUNT(*) AS count
           FROM pg_attribute a
           JOIN pg_type t ON t.oid = a.atttypid
          WHERE t.typname = $1
            AND a.attisdropped = false`,
        [enumTypeName],
      );
      if (Number(usage[0]?.count ?? 0) === 0) {
        await queryRunner.query(`DROP TYPE IF EXISTS "${enumTypeName}"`);
      }
    }

    // --- invoices: idempotency columns for generated invoices --------------
    const columns: TableColumn[] = [
      new TableColumn({
        name: 'fee_structure_id',
        type: 'uuid',
        isNullable: true,
      }),
      new TableColumn({
        name: 'billing_period',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      const exists = await queryRunner.hasColumn('invoices', column.name);
      if (!exists) {
        await queryRunner.addColumn('invoices', column);
      }
    }

    // Generation looks invoices up by (fee_structure_id, billing_period) on
    // every run, so index the pair. Partial-on-NULL is unnecessary: NULLs from
    // manual invoices are simply absent from equality lookups.
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_INVOICES_FEE_STRUCTURE_PERIOD',
        columnNames: ['fee_structure_id', 'billing_period'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('invoices', 'IDX_INVOICES_FEE_STRUCTURE_PERIOD');

    for (const name of ['billing_period', 'fee_structure_id']) {
      const exists = await queryRunner.hasColumn('invoices', name);
      if (exists) {
        await queryRunner.dropColumn('invoices', name);
      }
    }

    // Restore the original enum type. Rows created with the 'term' frequency
    // cannot be represented by the old enum, so they are folded into
    // 'one_time' before converting back (lossy, as down migrations on widened
    // domains inevitably are).
    await queryRunner.query(
      `UPDATE "fee_structures" SET "frequency" = 'one_time' WHERE "frequency" = 'term'`,
    );
    await queryRunner.query(
      `CREATE TYPE "fee_structures_frequency_enum" AS ENUM ('monthly', 'annual', 'one_time')`,
    );
    await queryRunner.query(`ALTER TABLE "fee_structures" ALTER COLUMN "frequency" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "fee_structures" ALTER COLUMN "frequency" TYPE "fee_structures_frequency_enum" USING "frequency"::"fee_structures_frequency_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fee_structures" ALTER COLUMN "frequency" SET DEFAULT 'monthly'`,
    );
  }
}
