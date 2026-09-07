import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * The badge and award-scheme module (TEM-18).
 *
 * Award schemes are data, not code: British Gymnastics Rise, the legacy
 * Proficiency Awards and a club's own badges are all rows in award_schemes
 * with their levels in award_levels. Nothing here encodes a particular
 * scheme; the starter catalogue is installed through the API.
 *
 * Every table carries club_id with a foreign key to clubs, matching the
 * tenancy contract the rest of the schema follows. Row-level security for
 * these tables lands in the next migration.
 */
export class CreateAwardTables1744204000000 implements MigrationInterface {
  private static readonly TABLES = [
    'award_assessment_outcomes',
    'award_assessment_events',
    'member_award_progress',
    'award_levels',
    'award_schemes',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'award_schemes',
        columns: [
          {
            name: 'scheme_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'source', type: 'varchar', length: '40', default: `'custom'` },
          { name: 'active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        uniques: [
          {
            name: 'UQ_AWARD_SCHEMES_CLUB_NAME',
            columnNames: ['club_id', 'name'],
          },
        ],
        indices: [{ name: 'IDX_AWARD_SCHEMES_CLUB_ID', columnNames: ['club_id'] }],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'award_levels',
        columns: [
          {
            name: 'level_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          { name: 'scheme_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'sort_order', type: 'integer', default: 0 },
          { name: 'badge_fee', type: 'decimal', precision: 10, scale: 2, isNullable: true },
          { name: 'certificate_fee', type: 'decimal', precision: 10, scale: 2, isNullable: true },
          { name: 'fee_structure_id', type: 'uuid', isNullable: true },
          { name: 'active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          { name: 'IDX_AWARD_LEVELS_CLUB_ID', columnNames: ['club_id'] },
          { name: 'IDX_AWARD_LEVELS_SCHEME_ID', columnNames: ['scheme_id'] },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'member_award_progress',
        columns: [
          {
            name: 'progress_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          { name: 'member_id', type: 'uuid' },
          { name: 'level_id', type: 'uuid' },
          { name: 'status', type: 'varchar', length: '20', default: `'working_towards'` },
          { name: 'started_on', type: 'date', isNullable: true },
          { name: 'assessed_on', type: 'date', isNullable: true },
          { name: 'awarded_on', type: 'date', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'invoice_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        uniques: [
          {
            name: 'UQ_MEMBER_AWARD_PROGRESS_MEMBER_LEVEL',
            columnNames: ['member_id', 'level_id'],
          },
        ],
        indices: [
          { name: 'IDX_MEMBER_AWARD_PROGRESS_CLUB_ID', columnNames: ['club_id'] },
          { name: 'IDX_MEMBER_AWARD_PROGRESS_MEMBER_ID', columnNames: ['member_id'] },
          { name: 'IDX_MEMBER_AWARD_PROGRESS_LEVEL_ID', columnNames: ['level_id'] },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'award_assessment_events',
        columns: [
          {
            name: 'event_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          { name: 'level_id', type: 'uuid' },
          { name: 'assessed_at', type: 'date' },
          { name: 'assessed_by_user_id', type: 'uuid', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          { name: 'IDX_AWARD_EVENTS_CLUB_ID', columnNames: ['club_id'] },
          { name: 'IDX_AWARD_EVENTS_LEVEL_ID', columnNames: ['level_id'] },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'award_assessment_outcomes',
        columns: [
          {
            name: 'outcome_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          { name: 'event_id', type: 'uuid' },
          { name: 'member_id', type: 'uuid' },
          { name: 'outcome', type: 'varchar', length: '20' },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'invoice_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          { name: 'IDX_AWARD_OUTCOMES_CLUB_ID', columnNames: ['club_id'] },
          { name: 'IDX_AWARD_OUTCOMES_EVENT_ID', columnNames: ['event_id'] },
          { name: 'IDX_AWARD_OUTCOMES_MEMBER_ID', columnNames: ['member_id'] },
        ],
      }),
      true,
    );

    // Foreign keys, added after every table exists so ordering cannot bite.
    const foreignKeys: Array<{ table: string; key: TableForeignKey }> = [
      {
        table: 'award_schemes',
        key: new TableForeignKey({
          name: 'FK_AWARD_SCHEMES_CLUB',
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'award_levels',
        key: new TableForeignKey({
          name: 'FK_AWARD_LEVELS_CLUB',
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'award_levels',
        key: new TableForeignKey({
          name: 'FK_AWARD_LEVELS_SCHEME',
          columnNames: ['scheme_id'],
          referencedColumnNames: ['scheme_id'],
          referencedTableName: 'award_schemes',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'member_award_progress',
        key: new TableForeignKey({
          name: 'FK_MEMBER_AWARD_PROGRESS_CLUB',
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'member_award_progress',
        key: new TableForeignKey({
          name: 'FK_MEMBER_AWARD_PROGRESS_MEMBER',
          columnNames: ['member_id'],
          referencedColumnNames: ['member_id'],
          referencedTableName: 'members',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'member_award_progress',
        key: new TableForeignKey({
          name: 'FK_MEMBER_AWARD_PROGRESS_LEVEL',
          columnNames: ['level_id'],
          referencedColumnNames: ['level_id'],
          referencedTableName: 'award_levels',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'award_assessment_events',
        key: new TableForeignKey({
          name: 'FK_AWARD_EVENTS_CLUB',
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'award_assessment_events',
        key: new TableForeignKey({
          name: 'FK_AWARD_EVENTS_LEVEL',
          columnNames: ['level_id'],
          referencedColumnNames: ['level_id'],
          referencedTableName: 'award_levels',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'award_assessment_outcomes',
        key: new TableForeignKey({
          name: 'FK_AWARD_OUTCOMES_CLUB',
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'award_assessment_outcomes',
        key: new TableForeignKey({
          name: 'FK_AWARD_OUTCOMES_EVENT',
          columnNames: ['event_id'],
          referencedColumnNames: ['event_id'],
          referencedTableName: 'award_assessment_events',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'award_assessment_outcomes',
        key: new TableForeignKey({
          name: 'FK_AWARD_OUTCOMES_MEMBER',
          columnNames: ['member_id'],
          referencedColumnNames: ['member_id'],
          referencedTableName: 'members',
          onDelete: 'CASCADE',
        }),
      },
    ];

    for (const { table, key } of foreignKeys) {
      await queryRunner.createForeignKey(table, key);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping each table takes its own indices, unique constraints and
    // foreign keys with it, and the order below is child-before-parent.
    for (const table of CreateAwardTables1744204000000.TABLES) {
      if (await queryRunner.hasTable(table)) {
        await queryRunner.dropTable(table);
      }
    }
  }
}
