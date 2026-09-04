import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePaymentsTable1703260900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the payments table
    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          {
            name: 'payment_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'invoice_id',
            type: 'uuid',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'payment_date',
            type: 'date',
          },
          {
            name: 'payment_method',
            type: 'enum',
            enum: ['direct_debit', 'card', 'cash', 'bank_transfer', 'other'],
            default: "'direct_debit'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending_submission', 'submitted', 'confirmed', 'failed'],
            default: "'pending_submission'",
          },
          {
            name: 'gocardless_payment_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reference_number',
            type: 'varchar',
            length: '255',
            isNullable: true,
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

    // Add foreign key to invoices table
    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['invoice_id'],
        referencedColumnNames: ['invoice_id'],
        referencedTableName: 'invoices',
        onDelete: 'CASCADE',
        name: 'FK_PAYMENTS_INVOICE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_PAYMENTS_INVOICE_ID',
        columnNames: ['invoice_id'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_PAYMENTS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_PAYMENTS_PAYMENT_DATE',
        columnNames: ['payment_date'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_PAYMENTS_GOCARDLESS_ID',
        columnNames: ['gocardless_payment_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('payments', 'IDX_PAYMENTS_GOCARDLESS_ID');
    await queryRunner.dropIndex('payments', 'IDX_PAYMENTS_PAYMENT_DATE');
    await queryRunner.dropIndex('payments', 'IDX_PAYMENTS_STATUS');
    await queryRunner.dropIndex('payments', 'IDX_PAYMENTS_INVOICE_ID');

    // Drop foreign key
    await queryRunner.dropForeignKey('payments', 'FK_PAYMENTS_INVOICE');

    // Drop table
    await queryRunner.dropTable('payments');
  }
}
