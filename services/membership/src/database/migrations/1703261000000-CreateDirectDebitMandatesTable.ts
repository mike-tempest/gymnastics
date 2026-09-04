import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateDirectDebitMandatesTable1703261000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the direct_debit_mandates table
    await queryRunner.createTable(
      new Table({
        name: 'direct_debit_mandates',
        columns: [
          {
            name: 'mandate_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'family_id',
            type: 'uuid',
          },
          {
            name: 'gocardless_mandate_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'active', 'cancelled', 'failed', 'expired'],
            default: "'pending'",
          },
          {
            name: 'scheme',
            type: 'varchar',
            length: '50',
            default: "'bacs'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign key to families table
    await queryRunner.createForeignKey(
      'direct_debit_mandates',
      new TableForeignKey({
        columnNames: ['family_id'],
        referencedColumnNames: ['family_id'],
        referencedTableName: 'families',
        onDelete: 'CASCADE',
        name: 'FK_DIRECT_DEBIT_MANDATES_FAMILY',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'direct_debit_mandates',
      new TableIndex({
        name: 'IDX_DIRECT_DEBIT_MANDATES_FAMILY_ID',
        columnNames: ['family_id'],
      }),
    );

    await queryRunner.createIndex(
      'direct_debit_mandates',
      new TableIndex({
        name: 'IDX_DIRECT_DEBIT_MANDATES_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'direct_debit_mandates',
      new TableIndex({
        name: 'IDX_DIRECT_DEBIT_MANDATES_GOCARDLESS_ID',
        columnNames: ['gocardless_mandate_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('direct_debit_mandates', 'IDX_DIRECT_DEBIT_MANDATES_GOCARDLESS_ID');
    await queryRunner.dropIndex('direct_debit_mandates', 'IDX_DIRECT_DEBIT_MANDATES_STATUS');
    await queryRunner.dropIndex('direct_debit_mandates', 'IDX_DIRECT_DEBIT_MANDATES_FAMILY_ID');

    // Drop foreign key
    await queryRunner.dropForeignKey('direct_debit_mandates', 'FK_DIRECT_DEBIT_MANDATES_FAMILY');

    // Drop table
    await queryRunner.dropTable('direct_debit_mandates');
  }
}
