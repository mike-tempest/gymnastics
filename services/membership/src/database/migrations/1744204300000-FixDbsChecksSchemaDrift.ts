import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bring `dbs_checks` back in line with the DBSCheck entity.
 *
 * The entity declares `uploaded_document_id` (uuid, nullable) and
 * `created_by_user_id` (uuid, nullable), but no migration ever created either
 * column. CreateComplianceTables1703261200000 created `document_url`
 * (varchar 500) and `metadata` (jsonb) instead, and no entity declares those.
 * TypeORM selects every declared column, so on a migration-built database
 * every DBS read failed with Postgres 42703 (undefined column) and
 * DBSRepository.create, which writes `created_by_user_id` explicitly, failed
 * on insert. That surfaced as a 500 on the compliance dashboard, because
 * QueryFailedErrorFilter only maps 22P02 to a 400.
 *
 * What this migration does:
 *  - adds `uploaded_document_id` and `created_by_user_id` as nullable uuid;
 *  - drops the orphaned `document_url` and `metadata`;
 *  - converts `check_type` and `status` from varchar(50) to real Postgres
 *    enum types, matching the entity and following the pattern established by
 *    ConvertAuditColumnsToEnums1744202850000.
 *
 * Data decision on `document_url`: nothing is copied into
 * `uploaded_document_id`. The old column is a varchar holding a URL; the new
 * one is a uuid holding a document reference. There is no mapping from one to
 * the other that is not an invention, and casting a URL to uuid simply fails.
 * `document_url` is also written by nothing: it is referenced only by its own
 * CREATE migration, no entity ever declared it, and this fork starts from an
 * empty database. Rather than assert that on trust, `up()` raises if any row
 * actually holds a value, so the column is never dropped while it carries
 * data. The same reasoning applies to the orphaned `metadata` column.
 *
 * The enum conversion is not given the same guard. Every writer of these two
 * columns goes through the shared-types enums, so the stored values are the
 * enum labels, and a value outside the list fails the conversion with
 * Postgres's own error naming the column and the offending value. Repeating
 * that check by hand would add nothing an operator could act on.
 *
 * Deliberately not touched: the DBS indexes and the user_id foreign key from
 * CreateComplianceTables, the `club_id` column from
 * AddClubIdColumnsNullable1744200700000 and its constraints, and the row level
 * security policies from EnableRowLevelSecurity1744203700000. None of them
 * reference the columns being changed in a way that an ALTER TYPE disturbs.
 *
 * Every statement is guarded so the migration is a no-op on a database built
 * by TypeORM synchronize, which already has the entity's shape.
 *
 * `down()` is symmetric: it restores `document_url` and `metadata` as empty
 * nullable columns and puts the varchar(50) types back. The uuid values held
 * in the two added columns are lost on the way down, because the schema they
 * are rolled back to has nowhere to put them.
 */
export class FixDbsChecksSchemaDrift1744204300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Refuse to drop a column that turns out to hold data. On every database
    // this migration is expected to meet, both columns are absent or empty.
    for (const column of ['document_url', 'metadata']) {
      if (await queryRunner.hasColumn('dbs_checks', column)) {
        const rows: { count: string }[] = await queryRunner.query(
          `SELECT COUNT(*)::text AS count FROM "dbs_checks" WHERE "${column}" IS NOT NULL`,
        );
        if (Number(rows[0]?.count ?? '0') > 0) {
          throw new Error(
            `dbs_checks."${column}" holds data. It cannot be migrated into the ` +
              'entity columns automatically. Export the values, clear the column, ' +
              'then run this migration again.',
          );
        }
      }
    }

    if (!(await queryRunner.hasColumn('dbs_checks', 'uploaded_document_id'))) {
      await queryRunner.query(`ALTER TABLE "dbs_checks" ADD COLUMN "uploaded_document_id" uuid`);
    }

    if (!(await queryRunner.hasColumn('dbs_checks', 'created_by_user_id'))) {
      await queryRunner.query(`ALTER TABLE "dbs_checks" ADD COLUMN "created_by_user_id" uuid`);
    }

    if (await queryRunner.hasColumn('dbs_checks', 'document_url')) {
      await queryRunner.query(`ALTER TABLE "dbs_checks" DROP COLUMN "document_url"`);
    }

    if (await queryRunner.hasColumn('dbs_checks', 'metadata')) {
      await queryRunner.query(`ALTER TABLE "dbs_checks" DROP COLUMN "metadata"`);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'dbs_checks_check_type_enum'
            AND n.nspname = current_schema()
        ) THEN
          CREATE TYPE "dbs_checks_check_type_enum" AS ENUM (
            'BASIC', 'STANDARD', 'ENHANCED', 'ENHANCED_BARRED',
            'SAFESPORT_CERTIFICATION', 'BACKGROUND_CHECK', 'CRIMINAL_RECORD_CHECK',
            'VULNERABLE_SECTOR_CHECK', 'WORKING_WITH_CHILDREN_CHECK',
            'GARDA_VETTING', 'BLUE_CARD', 'OCHRE_CARD', 'WWVP_REGISTRATION',
            'RWVP_REGISTRATION'
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
          WHERE t.typname = 'dbs_checks_status_enum'
            AND n.nspname = current_schema()
        ) THEN
          CREATE TYPE "dbs_checks_status_enum" AS ENUM (
            'PENDING', 'VALID', 'EXPIRING_SOON', 'EXPIRED', 'REJECTED'
          );
        END IF;
      END
      $$;
    `);

    // The varchar columns carry a default, which Postgres cannot cast across
    // an ALTER TYPE, so the default is dropped and restored around each one.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'dbs_checks'
            AND column_name = 'check_type'
            AND data_type = 'character varying'
        ) THEN
          ALTER TABLE "dbs_checks" ALTER COLUMN "check_type" DROP DEFAULT;
          ALTER TABLE "dbs_checks"
            ALTER COLUMN "check_type" TYPE "dbs_checks_check_type_enum"
            USING "check_type"::text::"dbs_checks_check_type_enum";
          ALTER TABLE "dbs_checks"
            ALTER COLUMN "check_type" SET DEFAULT 'ENHANCED'::"dbs_checks_check_type_enum";
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
            AND table_name = 'dbs_checks'
            AND column_name = 'status'
            AND data_type = 'character varying'
        ) THEN
          ALTER TABLE "dbs_checks" ALTER COLUMN "status" DROP DEFAULT;
          ALTER TABLE "dbs_checks"
            ALTER COLUMN "status" TYPE "dbs_checks_status_enum"
            USING "status"::text::"dbs_checks_status_enum";
          ALTER TABLE "dbs_checks"
            ALTER COLUMN "status" SET DEFAULT 'PENDING'::"dbs_checks_status_enum";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'dbs_checks'
            AND column_name = 'status'
            AND data_type = 'USER-DEFINED'
        ) THEN
          ALTER TABLE "dbs_checks" ALTER COLUMN "status" DROP DEFAULT;
          ALTER TABLE "dbs_checks"
            ALTER COLUMN "status" TYPE character varying(50)
            USING "status"::text;
          ALTER TABLE "dbs_checks" ALTER COLUMN "status" SET DEFAULT 'PENDING';
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
            AND table_name = 'dbs_checks'
            AND column_name = 'check_type'
            AND data_type = 'USER-DEFINED'
        ) THEN
          ALTER TABLE "dbs_checks" ALTER COLUMN "check_type" DROP DEFAULT;
          ALTER TABLE "dbs_checks"
            ALTER COLUMN "check_type" TYPE character varying(50)
            USING "check_type"::text;
          ALTER TABLE "dbs_checks" ALTER COLUMN "check_type" SET DEFAULT 'ENHANCED';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "dbs_checks_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "dbs_checks_check_type_enum"`);

    if (!(await queryRunner.hasColumn('dbs_checks', 'metadata'))) {
      await queryRunner.query(`ALTER TABLE "dbs_checks" ADD COLUMN "metadata" jsonb`);
    }

    if (!(await queryRunner.hasColumn('dbs_checks', 'document_url'))) {
      await queryRunner.query(
        `ALTER TABLE "dbs_checks" ADD COLUMN "document_url" character varying(500)`,
      );
    }

    if (await queryRunner.hasColumn('dbs_checks', 'created_by_user_id')) {
      await queryRunner.query(`ALTER TABLE "dbs_checks" DROP COLUMN "created_by_user_id"`);
    }

    if (await queryRunner.hasColumn('dbs_checks', 'uploaded_document_id')) {
      await queryRunner.query(`ALTER TABLE "dbs_checks" DROP COLUMN "uploaded_document_id"`);
    }
  }
}
