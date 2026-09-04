import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The waitlist captures PUBLIC, unauthenticated marketing-site sign-ups from
 * prospective clubs. At that point there is no tenant yet, so club_id cannot be
 * known. Phase 1 (EnforceClubIdConstraints) made every tenant table's club_id
 * NOT NULL, which is wrong for the waitlist specifically. Relax it back to
 * nullable. The FK to clubs and the index remain valid for nullable columns.
 */
export class WaitlistClubIdNullable1744201000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "waitlist" ALTER COLUMN "club_id" DROP NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore NOT NULL. Any rows with a null club_id (public signups) must be
    // resolved first; this will fail loudly otherwise, which is intended.
    await queryRunner.query(`ALTER TABLE "waitlist" ALTER COLUMN "club_id" SET NOT NULL;`);
  }
}
