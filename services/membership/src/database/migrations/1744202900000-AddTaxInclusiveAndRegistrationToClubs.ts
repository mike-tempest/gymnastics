import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds the two remaining per-club tax configuration columns needed for
 * Australian GST (and equivalent regimes elsewhere).
 *
 * tax_inclusive records whether the club's prices already include tax, as is
 * conventional in Australia, so invoice totals treat the line-item sum as the
 * gross amount and back the tax out of it. It defaults to false, preserving
 * the existing added-on-top behaviour for every current club.
 *
 * tax_registration_number stores the club's tax registration identifier
 * (ABN for AU, VAT number for GB, GST/HST number for CA). It stays NULL for
 * existing clubs, so nothing new renders on their invoices until they opt in.
 */
export class AddTaxInclusiveAndRegistrationToClubs1744202900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: TableColumn[] = [
      new TableColumn({
        name: 'tax_inclusive',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'tax_registration_number',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      const exists = await queryRunner.hasColumn('clubs', column.name);
      if (!exists) {
        await queryRunner.addColumn('clubs', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['tax_registration_number', 'tax_inclusive']) {
      const exists = await queryRunner.hasColumn('clubs', name);
      if (exists) {
        await queryRunner.dropColumn('clubs', name);
      }
    }
  }
}
