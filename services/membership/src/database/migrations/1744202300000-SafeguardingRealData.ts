import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Prepares the safeguarding tables for real, template-driven data.
 *
 * 1. Officer contact and vetting details become nullable. The create-officer
 *    API only requires name, role and email; phone, background-check number,
 *    expiry and qualifications are optional and can be filled in later.
 * 2. Checklist items gain a sort_order column so a club's checklist renders in
 *    template order. Rows seeded in one batch share a created_at timestamp, so
 *    ordering by created_at alone is non-deterministic.
 * 3. A unique index on (club_id, requirement) makes concurrent first-load
 *    seeding safe: the losing transaction hits the constraint instead of
 *    inserting a duplicate checklist.
 *
 * The three safeguarding tables were created by migration 1744200100000 but
 * held no production data (the service returned hardcoded mock data until
 * now), so these changes do not rewrite any existing rows.
 */
export class SafeguardingRealData1744202300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['phone', 'dbs_number', 'dbs_expiry', 'qualifications']) {
      await queryRunner.query(
        `ALTER TABLE "safeguarding_officers" ALTER COLUMN "${column}" DROP NOT NULL`,
      );
    }

    await queryRunner.addColumn(
      'safeguarding_checklist_items',
      new TableColumn({
        name: 'sort_order',
        type: 'int',
        default: 0,
      }),
    );

    await queryRunner.createIndex(
      'safeguarding_checklist_items',
      new TableIndex({
        name: 'UQ_SAFEGUARDING_CHECKLIST_CLUB_REQUIREMENT',
        columnNames: ['club_id', 'requirement'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'safeguarding_checklist_items',
      'UQ_SAFEGUARDING_CHECKLIST_CLUB_REQUIREMENT',
    );
    await queryRunner.dropColumn('safeguarding_checklist_items', 'sort_order');

    for (const column of ['phone', 'dbs_number', 'dbs_expiry', 'qualifications']) {
      await queryRunner.query(
        `ALTER TABLE "safeguarding_officers" ALTER COLUMN "${column}" SET NOT NULL`,
      );
    }
  }
}
