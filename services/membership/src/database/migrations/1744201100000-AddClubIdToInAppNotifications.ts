import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `in_app_notifications` table exists on the production database but its
 * CREATE migration is no longer present in this repo, so a clean migration-built
 * database (e.g. local dev) does NOT have it. Multi-tenancy Phase 1 therefore
 * could not enforce club_id on it. This migration retroactively does so where
 * the table exists, and is a clean no-op where it does not.
 *
 * The production table currently has zero rows; this migration is still written
 * defensively to handle a non-empty future state (derive club_id from the
 * referenced user; fall back to the oldest club for any orphan rows).
 */
export class AddClubIdToInAppNotifications1744201100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('in_app_notifications');
    if (!hasTable) return;

    // 1. Add nullable column if not present.
    const hasColumn = await queryRunner.hasColumn('in_app_notifications', 'club_id');
    if (!hasColumn) {
      await queryRunner.query(`ALTER TABLE "in_app_notifications" ADD COLUMN "club_id" uuid;`);
    }

    // 2. Backfill from the referenced user's club.
    await queryRunner.query(`
      UPDATE "in_app_notifications" n
      SET club_id = u.club_id
      FROM "users" u
      WHERE n.user_id = u.user_id AND n.club_id IS NULL;
    `);

    // 3. Any orphan rows (dangling user_id) get the oldest club, so the NOT
    //    NULL enforcement below cannot fail.
    const orphans = await queryRunner.query(
      `SELECT COUNT(*)::int AS n FROM "in_app_notifications" WHERE club_id IS NULL;`,
    );
    if ((orphans?.[0]?.n ?? 0) > 0) {
      const oldest = await queryRunner.query(
        `SELECT id FROM "clubs" ORDER BY created_at ASC LIMIT 1;`,
      );
      const fallbackClub = oldest?.[0]?.id;
      if (!fallbackClub) {
        throw new Error(
          'AddClubIdToInAppNotifications: orphan notifications exist but no club is available to backfill them to.',
        );
      }
      await queryRunner.query(
        `UPDATE "in_app_notifications" SET club_id = $1 WHERE club_id IS NULL;`,
        [fallbackClub],
      );
    }

    // 4. Enforce.
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" ALTER COLUMN "club_id" SET NOT NULL;`,
    );
    await queryRunner.query(`
      ALTER TABLE "in_app_notifications"
      ADD CONSTRAINT "FK_IN_APP_NOTIFICATIONS_CLUB"
      FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT;
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_IN_APP_NOTIFICATIONS_CLUB" ON "in_app_notifications" ("club_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('in_app_notifications');
    if (!hasTable) return;

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_IN_APP_NOTIFICATIONS_CLUB";`);
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT IF EXISTS "FK_IN_APP_NOTIFICATIONS_CLUB";`,
    );
    const hasColumn = await queryRunner.hasColumn('in_app_notifications', 'club_id');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "in_app_notifications" DROP COLUMN "club_id";`);
    }
  }
}
