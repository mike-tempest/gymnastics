import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the Swimmer entity's database objects to Member, per
 * docs/03-Swimmer-to-Member-Codemod-Spec.md (TEM-13).
 *
 * Every statement is an in-place Postgres rename (metadata only, no data
 * copy): tables, columns, foreign-key and unique constraints, indexes and
 * one enum value. The se_number column becomes registration_number; the
 * field was already governing-body-agnostic via governing_body, the Swim
 * England name was the only residue.
 *
 * Deliberately not touched:
 * - UQ_swimmers_se_number: dropped by AddGoverningBodyToSwimmers
 *   (1744201200000); it does not exist on a live schema.
 * - audit_logs_entity_type_enum: no migration creates that type (the
 *   entity_type column is varchar(50) on a migration-built schema), so
 *   there is no 'SWIMMER' enum value here to rename.
 * - The members primary-key constraint keeps its generated name.
 */
export class RenameSwimmerToMember1744203800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tables
    await queryRunner.query(`ALTER TABLE "swimmers" RENAME TO "members"`);
    await queryRunner.query(`ALTER TABLE "swimmer_cycle_logs" RENAME TO "member_cycle_logs"`);
    await queryRunner.query(
      `ALTER TABLE "swimmer_wellbeing_logs" RENAME TO "member_wellbeing_logs"`,
    );
    await queryRunner.query(`ALTER TABLE "squad_swimmers" RENAME TO "squad_members"`);

    // Columns on members itself
    await queryRunner.query(`ALTER TABLE "members" RENAME COLUMN "swimmer_id" TO "member_id"`);
    await queryRunner.query(
      `ALTER TABLE "members" RENAME COLUMN "se_number" TO "registration_number"`,
    );

    // swimmer_id foreign-key columns
    await queryRunner.query(`ALTER TABLE "attendance" RENAME COLUMN "swimmer_id" TO "member_id"`);
    await queryRunner.query(
      `ALTER TABLE "competition_entries" RENAME COLUMN "swimmer_id" TO "member_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "competition_results" RENAME COLUMN "swimmer_id" TO "member_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "personal_bests" RENAME COLUMN "swimmer_id" TO "member_id"`,
    );
    await queryRunner.query(`ALTER TABLE "consents" RENAME COLUMN "swimmer_id" TO "member_id"`);
    await queryRunner.query(
      `ALTER TABLE "squad_members" RENAME COLUMN "swimmer_id" TO "member_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_cycle_logs" RENAME COLUMN "swimmer_id" TO "member_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME COLUMN "swimmer_id" TO "member_id"`,
    );

    // Foreign-key and unique constraints
    await queryRunner.query(
      `ALTER TABLE "attendance" RENAME CONSTRAINT "FK_ATTENDANCE_SWIMMER" TO "FK_ATTENDANCE_MEMBER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" RENAME CONSTRAINT "FK_SWIMMERS_CLUB" TO "FK_MEMBERS_CLUB"`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" RENAME CONSTRAINT "FK_SWIMMERS_FAMILY" TO "FK_MEMBERS_FAMILY"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_cycle_logs" RENAME CONSTRAINT "FK_CYCLE_SWIMMER" TO "FK_CYCLE_MEMBER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_cycle_logs" RENAME CONSTRAINT "FK_SWIMMER_CYCLE_LOGS_CLUB" TO "FK_MEMBER_CYCLE_LOGS_CLUB"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME CONSTRAINT "FK_WELLBEING_SWIMMER" TO "FK_WELLBEING_MEMBER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME CONSTRAINT "FK_SWIMMER_WELLBEING_LOGS_CLUB" TO "FK_MEMBER_WELLBEING_LOGS_CLUB"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME CONSTRAINT "UQ_WELLBEING_SWIMMER_DATE" TO "UQ_WELLBEING_MEMBER_DATE"`,
    );

    // Indexes (including the unique indexes created as plain indexes)
    await queryRunner.query(
      `ALTER INDEX "IDX_ATTENDANCE_SWIMMER_ID" RENAME TO "IDX_ATTENDANCE_MEMBER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_COMPETITION_ENTRIES_SWIMMER_ID" RENAME TO "IDX_COMPETITION_ENTRIES_MEMBER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_COMPETITION_RESULTS_SWIMMER_ID" RENAME TO "IDX_COMPETITION_RESULTS_MEMBER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_CONSENTS_SWIMMER_ID" RENAME TO "IDX_CONSENTS_MEMBER_ID"`,
    );
    await queryRunner.query(`ALTER INDEX "IDX_CYCLE_SWIMMER_ID" RENAME TO "IDX_CYCLE_MEMBER_ID"`);
    await queryRunner.query(
      `ALTER INDEX "IDX_PERSONAL_BESTS_SWIMMER_ID" RENAME TO "IDX_PERSONAL_BESTS_MEMBER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_SQUAD_SWIMMERS_SQUAD_ID" RENAME TO "IDX_SQUAD_MEMBERS_SQUAD_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_SQUAD_SWIMMERS_SWIMMER_ID" RENAME TO "IDX_SQUAD_MEMBERS_MEMBER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_SWIMMERS_CLUB_FAMILY" RENAME TO "IDX_MEMBERS_CLUB_FAMILY"`,
    );
    await queryRunner.query(`ALTER INDEX "IDX_SWIMMERS_CLUB_ID" RENAME TO "IDX_MEMBERS_CLUB_ID"`);
    await queryRunner.query(
      `ALTER INDEX "IDX_SWIMMERS_FAMILY_ID" RENAME TO "IDX_MEMBERS_FAMILY_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_SWIMMERS_LAST_NAME" RENAME TO "IDX_MEMBERS_LAST_NAME"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_SWIMMERS_SQUAD_ID" RENAME TO "IDX_MEMBERS_SQUAD_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_WELLBEING_SWIMMER_ID" RENAME TO "IDX_WELLBEING_MEMBER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_ATTENDANCE_SESSION_SWIMMER" RENAME TO "UQ_ATTENDANCE_SESSION_MEMBER"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_PERSONAL_BESTS_SWIMMER_EVENT" RENAME TO "UQ_PERSONAL_BESTS_MEMBER_EVENT"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_SWIMMERS_BODY_SE_NUMBER" RENAME TO "UQ_MEMBERS_BODY_REGISTRATION_NUMBER"`,
    );

    // Enum value used by fee_structures.applies_to_type
    await queryRunner.query(
      `ALTER TYPE "fee_structures_applies_to_type_enum" RENAME VALUE 'swimmer' TO 'member'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "fee_structures_applies_to_type_enum" RENAME VALUE 'member' TO 'swimmer'`,
    );

    await queryRunner.query(
      `ALTER INDEX "UQ_MEMBERS_BODY_REGISTRATION_NUMBER" RENAME TO "UQ_SWIMMERS_BODY_SE_NUMBER"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_PERSONAL_BESTS_MEMBER_EVENT" RENAME TO "UQ_PERSONAL_BESTS_SWIMMER_EVENT"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_ATTENDANCE_SESSION_MEMBER" RENAME TO "UQ_ATTENDANCE_SESSION_SWIMMER"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_WELLBEING_MEMBER_ID" RENAME TO "IDX_WELLBEING_SWIMMER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_MEMBERS_SQUAD_ID" RENAME TO "IDX_SWIMMERS_SQUAD_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_MEMBERS_LAST_NAME" RENAME TO "IDX_SWIMMERS_LAST_NAME"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_MEMBERS_FAMILY_ID" RENAME TO "IDX_SWIMMERS_FAMILY_ID"`,
    );
    await queryRunner.query(`ALTER INDEX "IDX_MEMBERS_CLUB_ID" RENAME TO "IDX_SWIMMERS_CLUB_ID"`);
    await queryRunner.query(
      `ALTER INDEX "IDX_MEMBERS_CLUB_FAMILY" RENAME TO "IDX_SWIMMERS_CLUB_FAMILY"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_SQUAD_MEMBERS_MEMBER_ID" RENAME TO "IDX_SQUAD_SWIMMERS_SWIMMER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_SQUAD_MEMBERS_SQUAD_ID" RENAME TO "IDX_SQUAD_SWIMMERS_SQUAD_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_PERSONAL_BESTS_MEMBER_ID" RENAME TO "IDX_PERSONAL_BESTS_SWIMMER_ID"`,
    );
    await queryRunner.query(`ALTER INDEX "IDX_CYCLE_MEMBER_ID" RENAME TO "IDX_CYCLE_SWIMMER_ID"`);
    await queryRunner.query(
      `ALTER INDEX "IDX_CONSENTS_MEMBER_ID" RENAME TO "IDX_CONSENTS_SWIMMER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_COMPETITION_RESULTS_MEMBER_ID" RENAME TO "IDX_COMPETITION_RESULTS_SWIMMER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_COMPETITION_ENTRIES_MEMBER_ID" RENAME TO "IDX_COMPETITION_ENTRIES_SWIMMER_ID"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_ATTENDANCE_MEMBER_ID" RENAME TO "IDX_ATTENDANCE_SWIMMER_ID"`,
    );

    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME CONSTRAINT "UQ_WELLBEING_MEMBER_DATE" TO "UQ_WELLBEING_SWIMMER_DATE"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME CONSTRAINT "FK_MEMBER_WELLBEING_LOGS_CLUB" TO "FK_SWIMMER_WELLBEING_LOGS_CLUB"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME CONSTRAINT "FK_WELLBEING_MEMBER" TO "FK_WELLBEING_SWIMMER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_cycle_logs" RENAME CONSTRAINT "FK_MEMBER_CYCLE_LOGS_CLUB" TO "FK_SWIMMER_CYCLE_LOGS_CLUB"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_cycle_logs" RENAME CONSTRAINT "FK_CYCLE_MEMBER" TO "FK_CYCLE_SWIMMER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" RENAME CONSTRAINT "FK_MEMBERS_FAMILY" TO "FK_SWIMMERS_FAMILY"`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" RENAME CONSTRAINT "FK_MEMBERS_CLUB" TO "FK_SWIMMERS_CLUB"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance" RENAME CONSTRAINT "FK_ATTENDANCE_MEMBER" TO "FK_ATTENDANCE_SWIMMER"`,
    );

    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME COLUMN "member_id" TO "swimmer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_cycle_logs" RENAME COLUMN "member_id" TO "swimmer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "squad_members" RENAME COLUMN "member_id" TO "swimmer_id"`,
    );
    await queryRunner.query(`ALTER TABLE "consents" RENAME COLUMN "member_id" TO "swimmer_id"`);
    await queryRunner.query(
      `ALTER TABLE "personal_bests" RENAME COLUMN "member_id" TO "swimmer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "competition_results" RENAME COLUMN "member_id" TO "swimmer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "competition_entries" RENAME COLUMN "member_id" TO "swimmer_id"`,
    );
    await queryRunner.query(`ALTER TABLE "attendance" RENAME COLUMN "member_id" TO "swimmer_id"`);

    await queryRunner.query(
      `ALTER TABLE "members" RENAME COLUMN "registration_number" TO "se_number"`,
    );
    await queryRunner.query(`ALTER TABLE "members" RENAME COLUMN "member_id" TO "swimmer_id"`);

    await queryRunner.query(`ALTER TABLE "squad_members" RENAME TO "squad_swimmers"`);
    await queryRunner.query(
      `ALTER TABLE "member_wellbeing_logs" RENAME TO "swimmer_wellbeing_logs"`,
    );
    await queryRunner.query(`ALTER TABLE "member_cycle_logs" RENAME TO "swimmer_cycle_logs"`);
    await queryRunner.query(`ALTER TABLE "members" RENAME TO "swimmers"`);
  }
}
