import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSquadsTable1703260200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create squads table
    await queryRunner.createTable(
      new Table({
        name: 'squads',
        columns: [
          {
            name: 'squad_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'squad_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'min_age',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'max_age',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'coach_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'training_times',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'max_capacity',
            type: 'int',
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

    // Create squad_swimmers junction table for many-to-many relationship
    await queryRunner.createTable(
      new Table({
        name: 'squad_swimmers',
        columns: [
          {
            name: 'squad_id',
            type: 'uuid',
          },
          {
            name: 'swimmer_id',
            type: 'uuid',
          },
          {
            name: 'joined_date',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create composite primary key for squad_swimmers
    await queryRunner.createPrimaryKey('squad_swimmers', ['squad_id', 'swimmer_id']);

    // Create foreign keys
    await queryRunner.createForeignKey(
      'squad_swimmers',
      new TableForeignKey({
        columnNames: ['squad_id'],
        referencedColumnNames: ['squad_id'],
        referencedTableName: 'squads',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'squad_swimmers',
      new TableForeignKey({
        columnNames: ['swimmer_id'],
        referencedColumnNames: ['swimmer_id'],
        referencedTableName: 'swimmers',
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'squads',
      new TableIndex({
        name: 'IDX_SQUADS_SQUAD_NAME',
        columnNames: ['squad_name'],
      }),
    );

    await queryRunner.createIndex(
      'squad_swimmers',
      new TableIndex({
        name: 'IDX_SQUAD_SWIMMERS_SQUAD_ID',
        columnNames: ['squad_id'],
      }),
    );

    await queryRunner.createIndex(
      'squad_swimmers',
      new TableIndex({
        name: 'IDX_SQUAD_SWIMMERS_SWIMMER_ID',
        columnNames: ['swimmer_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('squad_swimmers', 'IDX_SQUAD_SWIMMERS_SWIMMER_ID');
    await queryRunner.dropIndex('squad_swimmers', 'IDX_SQUAD_SWIMMERS_SQUAD_ID');
    await queryRunner.dropIndex('squads', 'IDX_SQUADS_SQUAD_NAME');

    // Drop foreign keys
    const squadSwimmersTable = await queryRunner.getTable('squad_swimmers');
    if (squadSwimmersTable) {
      const foreignKeys = squadSwimmersTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('squad_swimmers', foreignKey);
      }
    }

    // Drop tables
    await queryRunner.dropTable('squad_swimmers');
    await queryRunner.dropTable('squads');
  }
}
