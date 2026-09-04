import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateCompetitionsTables1744200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create competitions table
    await queryRunner.createTable(
      new Table({
        name: 'competitions',
        columns: [
          {
            name: 'competition_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'club_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'organiser',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'venue',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'start_date',
            type: 'date',
          },
          {
            name: 'end_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            default: "'open_meet'",
          },
          {
            name: 'course',
            type: 'varchar',
            length: '10',
            default: "'SC'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'draft'",
          },
          {
            name: 'entry_deadline',
            type: 'timestamp',
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

    // Create indexes for competitions
    await queryRunner.createIndex(
      'competitions',
      new TableIndex({
        name: 'IDX_COMPETITIONS_CLUB_ID',
        columnNames: ['club_id'],
      }),
    );

    await queryRunner.createIndex(
      'competitions',
      new TableIndex({
        name: 'IDX_COMPETITIONS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'competitions',
      new TableIndex({
        name: 'IDX_COMPETITIONS_START_DATE',
        columnNames: ['start_date'],
      }),
    );

    // Create competition_entries table
    await queryRunner.createTable(
      new Table({
        name: 'competition_entries',
        columns: [
          {
            name: 'entry_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'competition_id',
            type: 'uuid',
          },
          {
            name: 'swimmer_id',
            type: 'uuid',
          },
          {
            name: 'event_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'distance',
            type: 'int',
          },
          {
            name: 'stroke',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'entry_time',
            type: 'decimal',
            precision: 8,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'seed_time',
            type: 'decimal',
            precision: 8,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for competition_entries
    await queryRunner.createIndex(
      'competition_entries',
      new TableIndex({
        name: 'IDX_COMPETITION_ENTRIES_COMPETITION_ID',
        columnNames: ['competition_id'],
      }),
    );

    await queryRunner.createIndex(
      'competition_entries',
      new TableIndex({
        name: 'IDX_COMPETITION_ENTRIES_SWIMMER_ID',
        columnNames: ['swimmer_id'],
      }),
    );

    // Create foreign keys for competition_entries
    await queryRunner.createForeignKey(
      'competition_entries',
      new TableForeignKey({
        columnNames: ['competition_id'],
        referencedTableName: 'competitions',
        referencedColumnNames: ['competition_id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'competition_entries',
      new TableForeignKey({
        columnNames: ['swimmer_id'],
        referencedTableName: 'swimmers',
        referencedColumnNames: ['swimmer_id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create competition_results table
    await queryRunner.createTable(
      new Table({
        name: 'competition_results',
        columns: [
          {
            name: 'result_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'competition_id',
            type: 'uuid',
          },
          {
            name: 'swimmer_id',
            type: 'uuid',
          },
          {
            name: 'event_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'distance',
            type: 'int',
          },
          {
            name: 'stroke',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'time',
            type: 'decimal',
            precision: 8,
            scale: 2,
          },
          {
            name: 'place',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'heat',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'lane',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'dq',
            type: 'boolean',
            default: false,
          },
          {
            name: 'dq_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_pb',
            type: 'boolean',
            default: false,
          },
          {
            name: 'splits',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for competition_results
    await queryRunner.createIndex(
      'competition_results',
      new TableIndex({
        name: 'IDX_COMPETITION_RESULTS_COMPETITION_ID',
        columnNames: ['competition_id'],
      }),
    );

    await queryRunner.createIndex(
      'competition_results',
      new TableIndex({
        name: 'IDX_COMPETITION_RESULTS_SWIMMER_ID',
        columnNames: ['swimmer_id'],
      }),
    );

    // Create foreign keys for competition_results
    await queryRunner.createForeignKey(
      'competition_results',
      new TableForeignKey({
        columnNames: ['competition_id'],
        referencedTableName: 'competitions',
        referencedColumnNames: ['competition_id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'competition_results',
      new TableForeignKey({
        columnNames: ['swimmer_id'],
        referencedTableName: 'swimmers',
        referencedColumnNames: ['swimmer_id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order to respect foreign key dependencies
    await queryRunner.dropTable('competition_results');
    await queryRunner.dropTable('competition_entries');
    await queryRunner.dropTable('competitions');
  }
}
