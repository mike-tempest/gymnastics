import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSessionsTable1703260400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create sessions table
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          {
            name: 'session_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'squad_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'session_name',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'session_date',
            type: 'date',
          },
          {
            name: 'start_time',
            type: 'time',
          },
          {
            name: 'end_time',
            type: 'time',
          },
          {
            name: 'location',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'coach_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'max_participants',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
            default: "'scheduled'",
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

    // Create foreign key to squads table
    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        columnNames: ['squad_id'],
        referencedColumnNames: ['squad_id'],
        referencedTableName: 'squads',
        onDelete: 'SET NULL',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSIONS_SESSION_DATE',
        columnNames: ['session_date'],
      }),
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSIONS_SQUAD_ID',
        columnNames: ['squad_id'],
      }),
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSIONS_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('sessions', 'IDX_SESSIONS_STATUS');
    await queryRunner.dropIndex('sessions', 'IDX_SESSIONS_SQUAD_ID');
    await queryRunner.dropIndex('sessions', 'IDX_SESSIONS_SESSION_DATE');

    // Drop foreign key
    const sessionsTable = await queryRunner.getTable('sessions');
    if (sessionsTable) {
      const foreignKeys = sessionsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('sessions', foreignKey);
      }
    }

    // Drop table
    await queryRunner.dropTable('sessions');
  }
}
