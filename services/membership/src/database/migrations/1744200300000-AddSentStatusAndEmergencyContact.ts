import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSentStatusAndEmergencyContact1744200300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'sent' value to the invoices status enum type.
    // ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
    // but TypeORM runs each migration outside a transaction by default when
    // using the query method directly for DDL statements like this.
    await queryRunner.query(
      `ALTER TYPE invoices_status_enum ADD VALUE IF NOT EXISTS 'sent' AFTER 'draft'`,
    );

    await queryRunner.addColumn(
      'swimmers',
      new TableColumn({
        name: 'emergency_contact',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('swimmers', 'emergency_contact');

    // PostgreSQL does not support removing a single value from an enum type.
    // To fully reverse the 'sent' addition you would need to create a new enum
    // type without the value, migrate all rows, and swap the types. This is
    // intentionally left as a no-op because it is rarely needed and the extra
    // enum value is harmless.
  }
}
