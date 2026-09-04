import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSwimmersTable1703260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'swimmers',
        columns: [
          {
            name: 'swimmer_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'family_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'club_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'se_number',
            type: 'varchar',
            length: '20',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'dob',
            type: 'date',
          },
          {
            name: 'gender',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'squad_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'medical_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'photo_url',
            type: 'varchar',
            length: '500',
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

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'swimmers',
      new TableIndex({
        name: 'IDX_SWIMMERS_FAMILY_ID',
        columnNames: ['family_id'],
      }),
    );

    await queryRunner.createIndex(
      'swimmers',
      new TableIndex({
        name: 'IDX_SWIMMERS_CLUB_ID',
        columnNames: ['club_id'],
      }),
    );

    await queryRunner.createIndex(
      'swimmers',
      new TableIndex({
        name: 'IDX_SWIMMERS_SQUAD_ID',
        columnNames: ['squad_id'],
      }),
    );

    await queryRunner.createIndex(
      'swimmers',
      new TableIndex({
        name: 'IDX_SWIMMERS_LAST_NAME',
        columnNames: ['last_name'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('swimmers', 'IDX_SWIMMERS_LAST_NAME');
    await queryRunner.dropIndex('swimmers', 'IDX_SWIMMERS_SQUAD_ID');
    await queryRunner.dropIndex('swimmers', 'IDX_SWIMMERS_CLUB_ID');
    await queryRunner.dropIndex('swimmers', 'IDX_SWIMMERS_FAMILY_ID');
    await queryRunner.dropTable('swimmers');
  }
}
