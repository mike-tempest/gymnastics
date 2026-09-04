import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFeeStructuresTable1703260600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the fee_structures table
    await queryRunner.createTable(
      new Table({
        name: 'fee_structures',
        columns: [
          {
            name: 'fee_structure_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'frequency',
            type: 'enum',
            enum: ['monthly', 'annual', 'one_time'],
            default: "'monthly'",
          },
          {
            name: 'applies_to_type',
            type: 'enum',
            enum: ['club', 'squad', 'swimmer'],
            default: "'club'",
          },
          {
            name: 'applies_to_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'active',
            type: 'boolean',
            default: true,
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

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'fee_structures',
      new TableIndex({
        name: 'IDX_FEE_STRUCTURES_ACTIVE',
        columnNames: ['active'],
      }),
    );

    await queryRunner.createIndex(
      'fee_structures',
      new TableIndex({
        name: 'IDX_FEE_STRUCTURES_APPLIES_TO',
        columnNames: ['applies_to_type', 'applies_to_id'],
      }),
    );

    await queryRunner.createIndex(
      'fee_structures',
      new TableIndex({
        name: 'IDX_FEE_STRUCTURES_FREQUENCY',
        columnNames: ['frequency'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('fee_structures', 'IDX_FEE_STRUCTURES_FREQUENCY');
    await queryRunner.dropIndex('fee_structures', 'IDX_FEE_STRUCTURES_APPLIES_TO');
    await queryRunner.dropIndex('fee_structures', 'IDX_FEE_STRUCTURES_ACTIVE');

    // Drop table
    await queryRunner.dropTable('fee_structures');
  }
}
