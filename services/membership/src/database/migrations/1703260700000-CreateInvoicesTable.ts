import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateInvoicesTable1703260700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the invoices table
    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          {
            name: 'invoice_id',
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
            name: 'invoice_number',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'subtotal',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'tax_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'due_date',
            type: 'date',
          },
          {
            name: 'issued_date',
            type: 'date',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
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
      'invoices',
      new TableForeignKey({
        columnNames: ['family_id'],
        referencedColumnNames: ['family_id'],
        referencedTableName: 'families',
        onDelete: 'CASCADE',
        name: 'FK_INVOICES_FAMILY',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_INVOICES_FAMILY_ID',
        columnNames: ['family_id'],
      }),
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_INVOICES_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_INVOICES_DUE_DATE',
        columnNames: ['due_date'],
      }),
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'IDX_INVOICES_INVOICE_NUMBER',
        columnNames: ['invoice_number'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('invoices', 'IDX_INVOICES_INVOICE_NUMBER');
    await queryRunner.dropIndex('invoices', 'IDX_INVOICES_DUE_DATE');
    await queryRunner.dropIndex('invoices', 'IDX_INVOICES_STATUS');
    await queryRunner.dropIndex('invoices', 'IDX_INVOICES_FAMILY_ID');

    // Drop foreign key
    await queryRunner.dropForeignKey('invoices', 'FK_INVOICES_FAMILY');

    // Drop table
    await queryRunner.dropTable('invoices');
  }
}
