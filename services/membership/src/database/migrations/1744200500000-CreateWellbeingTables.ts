import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class CreateWellbeingTables1744200500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Wellbeing check-in logs
    await queryRunner.createTable(
      new Table({
        name: 'swimmer_wellbeing_logs',
        columns: [
          {
            name: 'log_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'swimmer_id',
            type: 'uuid',
          },
          {
            name: 'log_date',
            type: 'date',
          },
          {
            name: 'energy_level',
            type: 'smallint',
          },
          {
            name: 'sleep_quality',
            type: 'smallint',
            isNullable: true,
          },
          {
            name: 'comfort_in_water',
            type: 'smallint',
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'prefers_land_training',
            type: 'boolean',
            default: false,
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

    await queryRunner.createUniqueConstraint(
      'swimmer_wellbeing_logs',
      new TableUnique({
        name: 'UQ_WELLBEING_SWIMMER_DATE',
        columnNames: ['swimmer_id', 'log_date'],
      }),
    );

    await queryRunner.createIndex(
      'swimmer_wellbeing_logs',
      new TableIndex({
        name: 'IDX_WELLBEING_SWIMMER_ID',
        columnNames: ['swimmer_id'],
      }),
    );

    await queryRunner.createIndex(
      'swimmer_wellbeing_logs',
      new TableIndex({
        name: 'IDX_WELLBEING_LOG_DATE',
        columnNames: ['log_date'],
      }),
    );

    await queryRunner.createForeignKey(
      'swimmer_wellbeing_logs',
      new TableForeignKey({
        name: 'FK_WELLBEING_SWIMMER',
        columnNames: ['swimmer_id'],
        referencedColumnNames: ['swimmer_id'],
        referencedTableName: 'swimmers',
        onDelete: 'CASCADE',
      }),
    );

    // Cycle tracking logs (sensitive, separate table)
    await queryRunner.createTable(
      new Table({
        name: 'swimmer_cycle_logs',
        columns: [
          {
            name: 'log_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'swimmer_id',
            type: 'uuid',
          },
          {
            name: 'period_start',
            type: 'date',
          },
          {
            name: 'period_end',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'symptoms',
            type: 'jsonb',
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
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'swimmer_cycle_logs',
      new TableIndex({
        name: 'IDX_CYCLE_SWIMMER_ID',
        columnNames: ['swimmer_id'],
      }),
    );

    await queryRunner.createIndex(
      'swimmer_cycle_logs',
      new TableIndex({
        name: 'IDX_CYCLE_PERIOD_START',
        columnNames: ['period_start'],
      }),
    );

    await queryRunner.createForeignKey(
      'swimmer_cycle_logs',
      new TableForeignKey({
        name: 'FK_CYCLE_SWIMMER',
        columnNames: ['swimmer_id'],
        referencedColumnNames: ['swimmer_id'],
        referencedTableName: 'swimmers',
        onDelete: 'CASCADE',
      }),
    );

    // Add WELLBEING_CYCLE_TRACKING to the consents enum, if that enum exists.
    // On databases where consent_type is a plain varchar (the migration-built
    // schema) there is no enum to alter, so guard the ALTER TYPE.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'consents_consent_type_enum' AND n.nspname = 'public'
        ) THEN
          ALTER TYPE "public"."consents_consent_type_enum" ADD VALUE IF NOT EXISTS 'WELLBEING_CYCLE_TRACKING';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('swimmer_cycle_logs', 'FK_CYCLE_SWIMMER');
    await queryRunner.dropIndex('swimmer_cycle_logs', 'IDX_CYCLE_PERIOD_START');
    await queryRunner.dropIndex('swimmer_cycle_logs', 'IDX_CYCLE_SWIMMER_ID');
    await queryRunner.dropTable('swimmer_cycle_logs');

    await queryRunner.dropForeignKey('swimmer_wellbeing_logs', 'FK_WELLBEING_SWIMMER');
    await queryRunner.dropIndex('swimmer_wellbeing_logs', 'IDX_WELLBEING_LOG_DATE');
    await queryRunner.dropIndex('swimmer_wellbeing_logs', 'IDX_WELLBEING_SWIMMER_ID');
    await queryRunner.dropUniqueConstraint('swimmer_wellbeing_logs', 'UQ_WELLBEING_SWIMMER_DATE');
    await queryRunner.dropTable('swimmer_wellbeing_logs');

    // Note: PostgreSQL does not support removing enum values directly.
    // The WELLBEING_CYCLE_TRACKING value will remain in the enum.
  }
}
