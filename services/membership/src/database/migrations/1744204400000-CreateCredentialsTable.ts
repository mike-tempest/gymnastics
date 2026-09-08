import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Staff and gymnast credentials: first aid, coaching qualifications,
 * safeguarding training and anything else a club has to evidence (TEM-30).
 *
 * Until now the only credential the schema modelled was the background check.
 * Coaching qualifications lived as a free-text `qualifications` column on
 * safeguarding_officers, with no expiry date and nothing watching it, which is
 * exactly the notes field product rule 2 says compliance must not be.
 *
 * The subject is a choice, not a fixed table: most credentials belong to
 * staff and coaches (users), but a gymnast can hold one too, so user_id and
 * member_id are both nullable with a check constraint requiring exactly one.
 *
 * credential_type and status are varchar rather than Postgres enums, matching
 * the governing_body precedent: a club running its own training scheme should
 * not need a migration, and there is no database enum to keep in step with the
 * TypeScript one. Row-level security for this table lands in the next
 * migration.
 */
export class CreateCredentialsTable1744204400000 implements MigrationInterface {
  private static readonly TABLE = 'compliance_credentials';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: CreateCredentialsTable1744204400000.TABLE,
        columns: [
          {
            name: 'credential_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          // Exactly one of these is set; see the check constraint below.
          { name: 'user_id', type: 'uuid', isNullable: true },
          { name: 'member_id', type: 'uuid', isNullable: true },
          { name: 'credential_type', type: 'varchar', length: '40' },
          // What the credential actually is, e.g. "Emergency First Aid at
          // Work" or "UKCC Level 2 Coaching Womens Artistic Gymnastics".
          { name: 'title', type: 'varchar', length: '200' },
          { name: 'issuing_body', type: 'varchar', length: '200', isNullable: true },
          { name: 'reference_number', type: 'varchar', length: '100', isNullable: true },
          { name: 'issue_date', type: 'date' },
          // Null for a credential that does not expire.
          { name: 'expiry_date', type: 'date', isNullable: true },
          { name: 'status', type: 'varchar', length: '20', default: `'valid'` },
          // Where the certificate itself is filed: a URL or a club reference.
          { name: 'document_reference', type: 'varchar', length: '500', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'created_by_user_id', type: 'uuid', isNullable: true },
        ],
        indices: [
          { name: 'IDX_CREDENTIALS_CLUB_ID', columnNames: ['club_id'] },
          // The list page filters by status and the sweep orders by expiry,
          // both always within one club.
          { name: 'IDX_CREDENTIALS_CLUB_STATUS', columnNames: ['club_id', 'status'] },
          { name: 'IDX_CREDENTIALS_CLUB_EXPIRY', columnNames: ['club_id', 'expiry_date'] },
          { name: 'IDX_CREDENTIALS_USER', columnNames: ['user_id'] },
          { name: 'IDX_CREDENTIALS_MEMBER', columnNames: ['member_id'] },
        ],
      }),
      true,
    );

    // A credential belongs to a person, and to exactly one kind of person.
    await queryRunner.query(
      `ALTER TABLE "${CreateCredentialsTable1744204400000.TABLE}"
       ADD CONSTRAINT "CHK_CREDENTIAL_SUBJECT"
       CHECK (("user_id" IS NOT NULL AND "member_id" IS NULL)
           OR ("user_id" IS NULL AND "member_id" IS NOT NULL))`,
    );

    // A certificate number is unique within a club and credential type, not
    // globally: two clubs can legitimately hold the same awarding-body
    // reference, and a credential need not carry a number at all.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_CREDENTIALS_CLUB_TYPE_REFERENCE"
       ON "${CreateCredentialsTable1744204400000.TABLE}" ("club_id", "credential_type", "reference_number")
       WHERE "reference_number" IS NOT NULL`,
    );

    const foreignKeys = [
      new TableForeignKey({
        name: 'FK_CREDENTIALS_CLUB',
        columnNames: ['club_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'clubs',
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_CREDENTIALS_USER',
        columnNames: ['user_id'],
        referencedColumnNames: ['user_id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_CREDENTIALS_MEMBER',
        columnNames: ['member_id'],
        referencedColumnNames: ['member_id'],
        referencedTableName: 'members',
        onDelete: 'CASCADE',
      }),
    ];

    for (const key of foreignKeys) {
      await queryRunner.createForeignKey(CreateCredentialsTable1744204400000.TABLE, key);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the table takes its indices, check constraint and foreign keys
    // with it.
    if (await queryRunner.hasTable(CreateCredentialsTable1744204400000.TABLE)) {
      await queryRunner.dropTable(CreateCredentialsTable1744204400000.TABLE);
    }
  }
}
