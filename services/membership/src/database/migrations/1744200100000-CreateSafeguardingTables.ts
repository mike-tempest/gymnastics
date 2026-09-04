import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSafeguardingTables1744200100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create safeguarding_checklist_items table
    await queryRunner.createTable(
      new Table({
        name: 'safeguarding_checklist_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'requirement',
            type: 'varchar',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'completed',
            type: 'boolean',
            default: false,
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

    // Create the incident_status_enum type for safeguarding_incidents
    await queryRunner.query(
      `CREATE TYPE "incident_status_enum" AS ENUM ('open', 'under_review', 'resolved')`,
    );

    // Create safeguarding_incidents table
    await queryRunner.createTable(
      new Table({
        name: 'safeguarding_incidents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'date',
            type: 'date',
          },
          {
            name: 'category',
            type: 'varchar',
          },
          {
            name: 'summary',
            type: 'text',
          },
          {
            name: 'status',
            type: 'incident_status_enum',
            default: "'open'",
          },
          {
            name: 'reported_by',
            type: 'varchar',
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

    // Create indexes for safeguarding_incidents
    await queryRunner.createIndex(
      'safeguarding_incidents',
      new TableIndex({
        name: 'IDX_SAFEGUARDING_INCIDENTS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'safeguarding_incidents',
      new TableIndex({
        name: 'IDX_SAFEGUARDING_INCIDENTS_DATE',
        columnNames: ['date'],
      }),
    );

    // Create safeguarding_officers table
    await queryRunner.createTable(
      new Table({
        name: 'safeguarding_officers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
          },
          {
            name: 'role',
            type: 'varchar',
          },
          {
            name: 'email',
            type: 'varchar',
          },
          {
            name: 'phone',
            type: 'varchar',
          },
          {
            name: 'dbs_number',
            type: 'varchar',
          },
          {
            name: 'dbs_expiry',
            type: 'date',
          },
          {
            name: 'qualifications',
            type: 'text',
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

    // Create index for DBS expiry to support expiry monitoring queries
    await queryRunner.createIndex(
      'safeguarding_officers',
      new TableIndex({
        name: 'IDX_SAFEGUARDING_OFFICERS_DBS_EXPIRY',
        columnNames: ['dbs_expiry'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse creation order
    await queryRunner.dropTable('safeguarding_officers');
    await queryRunner.dropTable('safeguarding_incidents');
    await queryRunner.query(`DROP TYPE "incident_status_enum"`);
    await queryRunner.dropTable('safeguarding_checklist_items');
  }
}
