import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAttendanceTable1703260500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the attendance table
    await queryRunner.createTable(
      new Table({
        name: 'attendance',
        columns: [
          {
            name: 'attendance_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'session_id',
            type: 'uuid',
          },
          {
            name: 'swimmer_id',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['present', 'absent', 'late', 'excused'],
            default: "'present'",
          },
          {
            name: 'checked_in_at',
            type: 'timestamp',
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

    // Add unique constraint on session_id and swimmer_id
    await queryRunner.createIndex(
      'attendance',
      new TableIndex({
        name: 'UQ_ATTENDANCE_SESSION_SWIMMER',
        columnNames: ['session_id', 'swimmer_id'],
        isUnique: true,
      }),
    );

    // Add foreign key to sessions table
    await queryRunner.createForeignKey(
      'attendance',
      new TableForeignKey({
        columnNames: ['session_id'],
        referencedColumnNames: ['session_id'],
        referencedTableName: 'sessions',
        onDelete: 'CASCADE',
        name: 'FK_ATTENDANCE_SESSION',
      }),
    );

    // Add foreign key to swimmers table
    await queryRunner.createForeignKey(
      'attendance',
      new TableForeignKey({
        columnNames: ['swimmer_id'],
        referencedColumnNames: ['swimmer_id'],
        referencedTableName: 'swimmers',
        onDelete: 'CASCADE',
        name: 'FK_ATTENDANCE_SWIMMER',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'attendance',
      new TableIndex({
        name: 'IDX_ATTENDANCE_SESSION_ID',
        columnNames: ['session_id'],
      }),
    );

    await queryRunner.createIndex(
      'attendance',
      new TableIndex({
        name: 'IDX_ATTENDANCE_SWIMMER_ID',
        columnNames: ['swimmer_id'],
      }),
    );

    await queryRunner.createIndex(
      'attendance',
      new TableIndex({
        name: 'IDX_ATTENDANCE_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('attendance', 'IDX_ATTENDANCE_STATUS');
    await queryRunner.dropIndex('attendance', 'IDX_ATTENDANCE_SWIMMER_ID');
    await queryRunner.dropIndex('attendance', 'IDX_ATTENDANCE_SESSION_ID');

    // Drop foreign keys
    await queryRunner.dropForeignKey('attendance', 'FK_ATTENDANCE_SWIMMER');
    await queryRunner.dropForeignKey('attendance', 'FK_ATTENDANCE_SESSION');

    // Drop unique constraint
    await queryRunner.dropIndex('attendance', 'UQ_ATTENDANCE_SESSION_SWIMMER');

    // Drop table
    await queryRunner.dropTable('attendance');
  }
}
