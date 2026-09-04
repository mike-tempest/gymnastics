import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateCommunicationsAndSettingsTables1744200200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the recipient_type_enum type for communications
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "recipient_type_enum" AS ENUM ('all', 'squad', 'family'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );

    // Create communications table
    const hasCommunications = await queryRunner.hasTable('communications');
    if (!hasCommunications) {
      await queryRunner.createTable(
        new Table({
          name: 'communications',
          columns: [
            {
              name: 'communication_id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'subject',
              type: 'varchar',
              length: '200',
            },
            {
              name: 'body',
              type: 'text',
            },
            {
              name: 'recipient_type',
              type: 'recipient_type_enum',
            },
            {
              name: 'squad_id',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'family_id',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'recipient_count',
              type: 'integer',
              default: 0,
            },
            {
              name: 'sent_date',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
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
    }

    // Create indexes (IF NOT EXISTS via try/catch)
    const indexes = [
      { name: 'IDX_COMMUNICATIONS_SQUAD_ID', columns: ['squad_id'] },
      { name: 'IDX_COMMUNICATIONS_FAMILY_ID', columns: ['family_id'] },
      { name: 'IDX_COMMUNICATIONS_RECIPIENT_TYPE', columns: ['recipient_type'] },
      { name: 'IDX_COMMUNICATIONS_SENT_DATE', columns: ['sent_date'] },
    ];

    for (const idx of indexes) {
      try {
        await queryRunner.createIndex(
          'communications',
          new TableIndex({ name: idx.name, columnNames: idx.columns }),
        );
      } catch {
        // Index already exists
      }
    }

    // Create foreign keys with explicit names (idempotent via try/catch)
    const foreignKeys = [
      {
        name: 'FK_COMMUNICATIONS_SQUAD',
        columnNames: ['squad_id'],
        referencedTableName: 'squads',
        referencedColumnNames: ['squad_id'],
        onDelete: 'SET NULL' as const,
      },
      {
        name: 'FK_COMMUNICATIONS_FAMILY',
        columnNames: ['family_id'],
        referencedTableName: 'families',
        referencedColumnNames: ['family_id'],
        onDelete: 'SET NULL' as const,
      },
    ];

    for (const fk of foreignKeys) {
      try {
        await queryRunner.createForeignKey('communications', new TableForeignKey(fk));
      } catch {
        // Foreign key already exists
      }
    }

    // Create club_settings table
    const hasSettings = await queryRunner.hasTable('club_settings');
    if (!hasSettings) {
      await queryRunner.createTable(
        new Table({
          name: 'club_settings',
          columns: [
            {
              name: 'settings_id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'club_name',
              type: 'varchar',
              length: '255',
              default: "'Swim Club'",
            },
            {
              name: 'address',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'contact_email',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'phone',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'website',
              type: 'varchar',
              length: '512',
              isNullable: true,
            },
            {
              name: 'logo_url',
              type: 'varchar',
              length: '512',
              isNullable: true,
            },
            {
              name: 'swim_england',
              type: 'jsonb',
              isNullable: true,
              default: "'{}'",
            },
            {
              name: 'locations',
              type: 'jsonb',
              isNullable: true,
              default: "'[]'",
            },
            {
              name: 'billing_config',
              type: 'jsonb',
              isNullable: true,
              default: "'{}'",
            },
            {
              name: 'notification_prefs',
              type: 'jsonb',
              isNullable: true,
              default: "'{}'",
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
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('club_settings', true);
    await queryRunner.dropTable('communications', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "recipient_type_enum"`);
  }
}
