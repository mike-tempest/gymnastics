import { MigrationInterface, QueryRunner, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Phase 1 (4/4): Lock down the tenant key.
 *
 * - Set club_id NOT NULL on every tenant-owned table.
 * - Add a FK club_id -> clubs(id) ON DELETE RESTRICT (a club with data cannot
 *   be deleted; revisit if Phase 4/5 test teardown needs CASCADE).
 * - Add composite indexes with club_id leading on the hot query paths, so the
 *   scoped queries Phase 3 introduces can use an index on the tenant key.
 */

// Every tenant-owned table gets NOT NULL + FK. Order does not matter for these.
const TENANT_TABLES = [
  'users',
  'swimmers',
  'competitions',
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

function fkName(table: string): string {
  return `FK_${table.toUpperCase()}_CLUB`;
}

// Composite indexes (club_id leading) on the common query paths.
// Each entry: [table, [trailing columns...], indexName].
const COMPOSITE_INDEXES: Array<[string, string[], string]> = [
  ['swimmers', ['family_id'], 'IDX_SWIMMERS_CLUB_FAMILY'],
  ['families', [], 'IDX_FAMILIES_CLUB'],
  ['squads', [], 'IDX_SQUADS_CLUB'],
  ['sessions', ['session_date'], 'IDX_SESSIONS_CLUB_DATE'],
  ['invoices', ['family_id'], 'IDX_INVOICES_CLUB_FAMILY'],
  ['payments', ['invoice_id'], 'IDX_PAYMENTS_CLUB_INVOICE'],
  ['attendance', ['session_id'], 'IDX_ATTENDANCE_CLUB_SESSION'],
  ['communications', [], 'IDX_COMMUNICATIONS_CLUB'],
  ['waitlist', [], 'IDX_WAITLIST_CLUB'],
];

export class EnforceClubIdConstraints1744200900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // NOT NULL + FK for every tenant table.
    for (const table of TENANT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN club_id SET NOT NULL;`);
      await queryRunner.createForeignKey(
        table,
        new TableForeignKey({
          name: fkName(table),
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'RESTRICT',
        }),
      );
    }

    // Composite indexes (club_id leading) on hot paths.
    for (const [table, trailing, name] of COMPOSITE_INDEXES) {
      await queryRunner.createIndex(
        table,
        new TableIndex({
          name,
          columnNames: ['club_id', ...trailing],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, , name] of COMPOSITE_INDEXES) {
      await queryRunner.dropIndex(table, name);
    }

    for (const table of [...TENANT_TABLES].reverse()) {
      await queryRunner.dropForeignKey(table, fkName(table));
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN club_id DROP NOT NULL;`);
    }
  }
}
