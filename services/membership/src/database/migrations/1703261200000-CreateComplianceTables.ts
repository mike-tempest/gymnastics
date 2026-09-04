import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateComplianceTables1703261200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create DBS Checks table
    await queryRunner.createTable(
      new Table({
        name: 'dbs_checks',
        columns: [
          {
            name: 'dbs_check_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'certificate_number',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'check_type',
            type: 'varchar',
            length: '50',
            default: "'ENHANCED'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'PENDING'",
          },
          {
            name: 'issue_date',
            type: 'date',
          },
          {
            name: 'expiry_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'last_verified_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'verified_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'is_valid',
            type: 'boolean',
            default: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'document_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
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

    // Create indexes for DBS checks
    await queryRunner.createIndex(
      'dbs_checks',
      new TableIndex({
        name: 'IDX_DBS_CHECKS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'dbs_checks',
      new TableIndex({
        name: 'IDX_DBS_CHECKS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'dbs_checks',
      new TableIndex({
        name: 'IDX_DBS_CHECKS_EXPIRY_DATE',
        columnNames: ['expiry_date'],
      }),
    );

    // Create foreign key for user_id
    await queryRunner.createForeignKey(
      'dbs_checks',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['user_id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create Consents table
    await queryRunner.createTable(
      new Table({
        name: 'consents',
        columns: [
          {
            name: 'consent_id',
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
            name: 'consent_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'PENDING'",
          },
          {
            name: 'granted_by_user_id',
            type: 'uuid',
          },
          {
            name: 'granted_date',
            type: 'date',
          },
          {
            name: 'revoked_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'revoked_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'expiry_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'specific_conditions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'requires_annual_renewal',
            type: 'boolean',
            default: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
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

    // Create indexes for consents
    await queryRunner.createIndex(
      'consents',
      new TableIndex({
        name: 'IDX_CONSENTS_SWIMMER_ID',
        columnNames: ['swimmer_id'],
      }),
    );

    await queryRunner.createIndex(
      'consents',
      new TableIndex({
        name: 'IDX_CONSENTS_TYPE_STATUS',
        columnNames: ['consent_type', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'consents',
      new TableIndex({
        name: 'IDX_CONSENTS_EXPIRY_DATE',
        columnNames: ['expiry_date'],
      }),
    );

    // Create foreign keys for consents
    await queryRunner.createForeignKey(
      'consents',
      new TableForeignKey({
        columnNames: ['swimmer_id'],
        referencedTableName: 'swimmers',
        referencedColumnNames: ['swimmer_id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'consents',
      new TableForeignKey({
        columnNames: ['granted_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['user_id'],
        onDelete: 'SET NULL',
      }),
    );

    // Create Audit Logs table
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'audit_log_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'user_email',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'action',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'entity_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'entity_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'changes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
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

    // Create indexes for audit logs (optimized for common queries)
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_USER_ID_CREATED_AT',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_ENTITY_TYPE_ENTITY_ID',
        columnNames: ['entity_type', 'entity_id'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_ACTION',
        columnNames: ['action'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_LOGS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    // Create foreign key for user_id in audit logs
    await queryRunner.createForeignKey(
      'audit_logs',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['user_id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop audit_logs table and indexes
    await queryRunner.dropTable('audit_logs');

    // Drop consents table and indexes
    await queryRunner.dropTable('consents');

    // Drop dbs_checks table and indexes
    await queryRunner.dropTable('dbs_checks');
  }
}
