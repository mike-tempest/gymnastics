import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Generalises club affiliation beyond Swim England and adds per-club tax
 * configuration.
 *
 * The governing_body / governing_body_region / affiliation_number columns
 * supersede the swim_england_region / swim_england_affiliate_number pair,
 * which stay in place (deprecated, no longer written) so nothing breaks on
 * rollback. Existing clubs with Swim England data are backfilled as
 * SWIM_ENGLAND so their settings render unchanged.
 *
 * tax_rate / tax_label stay NULL for existing clubs, which keeps invoice
 * totals byte-identical (tax remains zero until a club opts in).
 */
export class AddGoverningBodyAndTaxToClubs1744201700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: TableColumn[] = [
      new TableColumn({
        name: 'governing_body',
        type: 'varchar',
        length: '40',
        isNullable: true,
      }),
      new TableColumn({
        name: 'governing_body_region',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'affiliation_number',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'tax_rate',
        type: 'decimal',
        precision: 5,
        scale: 2,
        isNullable: true,
      }),
      new TableColumn({
        name: 'tax_label',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      const exists = await queryRunner.hasColumn('clubs', column.name);
      if (!exists) {
        await queryRunner.addColumn('clubs', column);
      }
    }

    // Backfill: clubs with any Swim England affiliation data are Swim England
    // clubs; copy their region and affiliate number into the generic columns.
    await queryRunner.query(`
      UPDATE clubs
      SET governing_body = 'SWIM_ENGLAND',
          governing_body_region = swim_england_region,
          affiliation_number = swim_england_affiliate_number
      WHERE governing_body IS NULL
        AND (swim_england_region IS NOT NULL OR swim_england_affiliate_number IS NOT NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of [
      'tax_label',
      'tax_rate',
      'affiliation_number',
      'governing_body_region',
      'governing_body',
    ]) {
      const exists = await queryRunner.hasColumn('clubs', name);
      if (exists) {
        await queryRunner.dropColumn('clubs', name);
      }
    }
  }
}
