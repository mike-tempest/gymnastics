import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateInvoiceItemsTable1703260800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the invoice_items table
    await queryRunner.createTable(
      new Table({
        name: 'invoice_items',
        columns: [
          {
            name: 'item_id',
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
            name: 'description',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'unit_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'quantity',
            type: 'int',
            default: 1,
          },
          {
            name: 'total',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'fee_structure_id',
            type: 'uuid',
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
      'invoice_items',
      new TableForeignKey({
        columnNames: ['invoice_id'],
        referencedColumnNames: ['invoice_id'],
        referencedTableName: 'invoices',
        onDelete: 'CASCADE',
        name: 'FK_INVOICE_ITEMS_INVOICE',
      }),
    );

    // Add foreign key to fee_structures table
    await queryRunner.createForeignKey(
      'invoice_items',
      new TableForeignKey({
        columnNames: ['fee_structure_id'],
        referencedColumnNames: ['fee_structure_id'],
        referencedTableName: 'fee_structures',
        onDelete: 'SET NULL',
        name: 'FK_INVOICE_ITEMS_FEE_STRUCTURE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'invoice_items',
      new TableIndex({
        name: 'IDX_INVOICE_ITEMS_INVOICE_ID',
        columnNames: ['invoice_id'],
      }),
    );

    await queryRunner.createIndex(
      'invoice_items',
      new TableIndex({
        name: 'IDX_INVOICE_ITEMS_FEE_STRUCTURE_ID',
        columnNames: ['fee_structure_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('invoice_items', 'IDX_INVOICE_ITEMS_FEE_STRUCTURE_ID');
    await queryRunner.dropIndex('invoice_items', 'IDX_INVOICE_ITEMS_INVOICE_ID');

    // Drop foreign keys
    await queryRunner.dropForeignKey('invoice_items', 'FK_INVOICE_ITEMS_FEE_STRUCTURE');
    await queryRunner.dropForeignKey('invoice_items', 'FK_INVOICE_ITEMS_INVOICE');

    // Drop table
    await queryRunner.dropTable('invoice_items');
  }
}
