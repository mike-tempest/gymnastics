import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create the Postgres enum types for `audit_logs.action` and
 * `audit_logs.entity_type` and convert those columns to use them.
 *
 * CreateComplianceTables1703261200000 created both columns as varchar(50),
 * but the AuditLog entity declares them as enum columns, so databases built
 * with TypeORM synchronize got `audit_logs_action_enum` and
 * `audit_logs_entity_type_enum` while migration-built databases did not.
 * ExtendAuditEntityTypes1744202900000 then runs
 * `ALTER TYPE "audit_logs_entity_type_enum" ADD VALUE ...`, which fails on a
 * fresh, migration-built database because the type never existed there.
 *
 * This migration is deliberately timestamped between
 * MigrateToProviderColumns1744202800000 and
 * ExtendAuditEntityTypes1744202900000 so that on a fresh database the type
 * exists before ExtendAuditEntityTypes extends it. Historical migrations are
 * never edited; this new step closes the gap instead.
 *
 * The enum is created with only the original eleven entity-type values (and
 * the eight action values) that the entity declared before the extension.
 * ExtendAuditEntityTypes still performs the extension itself, so the
 * migration history stays honest. One deliberate deviation: the value is
 * seeded as MEMBER rather than the pre-rename SWIMMER label, because the
 * RenameSwimmerToMember migration does not touch this enum (the column was
 * varchar on migration-built databases when it was written) and the renamed
 * audit code writes MEMBER. A fresh database on this fork never needs the
 * SWIMMER label.
 *
 * Every statement is guarded so the migration is a no-op on databases that
 * already have the types and enum-typed columns (synchronize-built dev
 * databases, where this migration runs after ExtendAuditEntityTypes has
 * already been recorded).
 */
export class ConvertAuditColumnsToEnums1744202850000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'audit_logs_action_enum'
            AND n.nspname = current_schema()
        ) THEN
          CREATE TYPE "audit_logs_action_enum" AS ENUM (
            'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'EXPORT', 'PRINT'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'audit_logs_entity_type_enum'
            AND n.nspname = current_schema()
        ) THEN
          CREATE TYPE "audit_logs_entity_type_enum" AS ENUM (
            'USER', 'MEMBER', 'FAMILY', 'SQUAD', 'SESSION', 'INVOICE',
            'PAYMENT', 'DBS_CHECK', 'CONSENT', 'MESSAGE', 'DOCUMENT'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'audit_logs'
            AND column_name = 'action'
            AND data_type = 'character varying'
        ) THEN
          ALTER TABLE "audit_logs"
            ALTER COLUMN "action" TYPE "audit_logs_action_enum"
            USING "action"::text::"audit_logs_action_enum";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'audit_logs'
            AND column_name = 'entity_type'
            AND data_type = 'character varying'
        ) THEN
          ALTER TABLE "audit_logs"
            ALTER COLUMN "entity_type" TYPE "audit_logs_entity_type_enum"
            USING "entity_type"::text::"audit_logs_entity_type_enum";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the varchar(50) columns from CreateComplianceTables and drop the
    // types. Any values added later by ExtendAuditEntityTypes survive as plain
    // text, which is exactly what a varchar column stores.
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ALTER COLUMN "entity_type" TYPE character varying(50)
        USING "entity_type"::text
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ALTER COLUMN "action" TYPE character varying(50)
        USING "action"::text
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_logs_entity_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_logs_action_enum"`);
  }
}
