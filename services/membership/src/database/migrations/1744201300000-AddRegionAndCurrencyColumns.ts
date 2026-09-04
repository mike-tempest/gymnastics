import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Payments regionalisation, phase 1: add a per-club country and currency, and a
 * currency on the financial entities so amounts record what they are
 * denominated in.
 *
 * Every column is NOT NULL with a default (GB / GBP), so existing rows are
 * back-filled to the previous UK-only behaviour and nothing changes for GBP
 * clubs. Each add is guarded with hasColumn so the migration is idempotent.
 *
 *  - clubs.country        ISO 3166-1 alpha-2, default GB
 *  - clubs.currency       ISO 4217, default GBP
 *  - invoices.currency    ISO 4217, default GBP
 *  - payments.currency    ISO 4217, default GBP
 *  - fee_structures.currency ISO 4217, default GBP
 */
export class AddRegionAndCurrencyColumns1744201300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasClubCountry = await queryRunner.hasColumn('clubs', 'country');
    if (!hasClubCountry) {
      await queryRunner.addColumn(
        'clubs',
        new TableColumn({
          name: 'country',
          type: 'varchar',
          length: '2',
          isNullable: false,
          default: "'GB'",
        }),
      );
    }

    const hasClubCurrency = await queryRunner.hasColumn('clubs', 'currency');
    if (!hasClubCurrency) {
      await queryRunner.addColumn(
        'clubs',
        new TableColumn({
          name: 'currency',
          type: 'varchar',
          length: '3',
          isNullable: false,
          default: "'GBP'",
        }),
      );
    }

    for (const table of ['invoices', 'payments', 'fee_structures']) {
      const hasCurrency = await queryRunner.hasColumn(table, 'currency');
      if (!hasCurrency) {
        await queryRunner.addColumn(
          table,
          new TableColumn({
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
            default: "'GBP'",
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['fee_structures', 'payments', 'invoices']) {
      const hasCurrency = await queryRunner.hasColumn(table, 'currency');
      if (hasCurrency) {
        await queryRunner.dropColumn(table, 'currency');
      }
    }

    const hasClubCurrency = await queryRunner.hasColumn('clubs', 'currency');
    if (hasClubCurrency) {
      await queryRunner.dropColumn('clubs', 'currency');
    }

    const hasClubCountry = await queryRunner.hasColumn('clubs', 'country');
    if (hasClubCountry) {
      await queryRunner.dropColumn('clubs', 'country');
    }
  }
}
