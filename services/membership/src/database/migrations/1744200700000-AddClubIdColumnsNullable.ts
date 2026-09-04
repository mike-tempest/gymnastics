import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Phase 1 (2/4): Add a NULLABLE `club_id uuid` column (no FK yet) to every
 * tenant-owned table that lacks one.
 *
 * `swimmers` and `competitions` already have a nullable club_id from their
 * CREATE migrations, so they are intentionally omitted. `users` has a club_id
 * on the production database (added out-of-band) but NOT on a clean
 * migration-built database, so it is included here and guarded with hasColumn
 * to stay idempotent across both. The next migration backfills all of them; the
 * one after enforces NOT NULL + FK.
 */
const TABLES_NEEDING_CLUB_ID = [
  'users',
  'club_settings',
  'families',
  'family_invites',
  'squads',
  'sessions',
  'attendance',
  'invoices',
  'invoice_items',
  'payments',
  'direct_debit_mandates',
  'fee_structures',
  'communications',
  'consents',
  'audit_logs',
  'dbs_checks',
  'safeguarding_incidents',
  'safeguarding_officers',
  'safeguarding_checklist_items',
  'competition_entries',
  'competition_results',
  'swimmer_cycle_logs',
  'swimmer_wellbeing_logs',
  'waitlist',
];

export class AddClubIdColumnsNullable1744200700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES_NEEDING_CLUB_ID) {
      const hasColumn = await queryRunner.hasColumn(table, 'club_id');
      if (!hasColumn) {
        await queryRunner.addColumn(
          table,
          new TableColumn({
            name: 'club_id',
            type: 'uuid',
            isNullable: true,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES_NEEDING_CLUB_ID].reverse()) {
      const hasColumn = await queryRunner.hasColumn(table, 'club_id');
      if (hasColumn) {
        await queryRunner.dropColumn(table, 'club_id');
      }
    }
  }
}
