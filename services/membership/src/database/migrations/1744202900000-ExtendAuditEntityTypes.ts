import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extend `audit_logs_entity_type_enum` so the audit trail can name the parts of
 * the product that had no matching value.
 *
 * The original enum covered eleven entities but omitted several that users
 * touch constantly (attendance registers, the club record itself, competitions,
 * the waitlist, wellbeing logs, settings, fee structures and mandates). Without
 * these, an audit interceptor has to mis-file those events under a loosely
 * related type, which makes the resulting activity data untrustworthy for
 * exactly the questions it is meant to answer.
 *
 * Safety notes:
 *  - `ADD VALUE IF NOT EXISTS` is idempotent, so re-running is harmless.
 *  - PostgreSQL 12+ permits `ALTER TYPE ... ADD VALUE` inside a transaction so
 *    long as the new value is not *used* in that same transaction. This
 *    migration only declares the values, so it is safe under TypeORM's default
 *    single-transaction migration run. Production is PostgreSQL 16.
 *  - PostgreSQL cannot drop a value from an enum, so `down()` is deliberately a
 *    no-op rather than a destructive rebuild of the type. Leaving unused labels
 *    in place is harmless; dropping and recreating the type would require
 *    rewriting every audit_logs row.
 */
export class ExtendAuditEntityTypes1744202900000 implements MigrationInterface {
  private static readonly NEW_VALUES = [
    'ATTENDANCE',
    'CLUB',
    'COMPETITION',
    'WAITLIST',
    'WELLBEING',
    'SETTINGS',
    'FEE_STRUCTURE',
    'MANDATE',
    'REPORT',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ExtendAuditEntityTypes1744202900000.NEW_VALUES) {
      await queryRunner.query(
        `ALTER TYPE "audit_logs_entity_type_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Intentionally empty: PostgreSQL provides no way to remove a value from an
    // enum type. Reverting would mean recreating the type and rewriting every
    // audit_logs row, which is far more destructive than leaving unused labels.
  }
}
