import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * The club's own waiting list and the offers made from it (TEM-22).
 *
 * Not to be confused with the `waitlist` table, which is the launch waiting
 * list clubs join to hear about the product. These tables are the club's list
 * of children waiting for a place in one of its classes.
 *
 * A child joins with no account at all, so the parent's details sit on the
 * entry rather than on a family record: the family is created only when the
 * place is taken. Position on the list is derived from the priority columns
 * and joined_at, never stored, so a boost or a withdrawal reorders the list
 * without a rewrite.
 *
 * Every table carries club_id with a foreign key to clubs, matching the
 * tenancy contract the rest of the schema follows. Row-level security for
 * these tables lands in the next migration.
 */
export class CreateWaitingListTables1744204200000 implements MigrationInterface {
  private static readonly TABLES = [
    'waiting_list_offers',
    'waiting_list_entries',
    'waiting_list_settings',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'waiting_list_entries',
        columns: [
          {
            name: 'entry_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          { name: 'child_first_name', type: 'varchar', length: '100' },
          { name: 'child_last_name', type: 'varchar', length: '100' },
          { name: 'child_dob', type: 'date' },
          { name: 'child_gender', type: 'varchar', length: '10', isNullable: true },
          { name: 'parent_name', type: 'varchar', length: '200' },
          { name: 'parent_email', type: 'varchar', length: '255' },
          { name: 'parent_phone', type: 'varchar', length: '20', isNullable: true },
          // What the family asked for. Any of these may be left open, in which
          // case the entry is eligible for any squad with a free place.
          { name: 'desired_discipline', type: 'varchar', length: '40', isNullable: true },
          { name: 'desired_squad_type', type: 'varchar', length: '20', isNullable: true },
          { name: 'preferred_squad_id', type: 'uuid', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'joined_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          // Priority flags. Ordered boost, then existing family, then sibling,
          // then joined_at; see WAITING_LIST_PRIORITY_ORDER in shared-types.
          { name: 'is_existing_member_family', type: 'boolean', default: false },
          { name: 'is_sibling', type: 'boolean', default: false },
          { name: 'priority_boost', type: 'integer', default: 0 },
          { name: 'status', type: 'varchar', length: '20', default: `'waiting'` },
          { name: 'enrolled_member_id', type: 'uuid', isNullable: true },
          { name: 'withdrawn_reason', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          { name: 'IDX_WAITING_LIST_ENTRIES_CLUB_ID', columnNames: ['club_id'] },
          // The ordering query filters on status and then sorts by the
          // priority columns, so the composite index carries both.
          {
            name: 'IDX_WAITING_LIST_ENTRIES_CLUB_STATUS',
            columnNames: ['club_id', 'status', 'joined_at'],
          },
          {
            name: 'IDX_WAITING_LIST_ENTRIES_PARENT_EMAIL',
            columnNames: ['club_id', 'parent_email'],
          },
          {
            name: 'IDX_WAITING_LIST_ENTRIES_PREFERRED_SQUAD',
            columnNames: ['preferred_squad_id'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'waiting_list_offers',
        columns: [
          {
            name: 'offer_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          { name: 'entry_id', type: 'uuid' },
          { name: 'squad_id', type: 'uuid' },
          { name: 'offered_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'expires_at', type: 'timestamptz' },
          { name: 'status', type: 'varchar', length: '20', default: `'pending'` },
          { name: 'decline_reason', type: 'text', isNullable: true },
          { name: 'responded_at', type: 'timestamptz', isNullable: true },
          // Random, single-use link the parent follows from the offer email.
          // Unique across every club so the token alone identifies the offer,
          // which is what lets the accept endpoint stay public.
          { name: 'accept_token', type: 'varchar', length: '64', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        uniques: [{ name: 'UQ_WAITING_LIST_OFFERS_ACCEPT_TOKEN', columnNames: ['accept_token'] }],
        indices: [
          { name: 'IDX_WAITING_LIST_OFFERS_CLUB_ID', columnNames: ['club_id'] },
          { name: 'IDX_WAITING_LIST_OFFERS_ENTRY_ID', columnNames: ['entry_id'] },
          // The capacity calculation counts pending offers per squad, and the
          // expiry sweep looks for pending offers past their window.
          {
            name: 'IDX_WAITING_LIST_OFFERS_SQUAD_STATUS',
            columnNames: ['squad_id', 'status'],
          },
          {
            name: 'IDX_WAITING_LIST_OFFERS_STATUS_EXPIRES',
            columnNames: ['status', 'expires_at'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'waiting_list_settings',
        columns: [
          // One row per club, so club_id is the primary key.
          { name: 'club_id', type: 'uuid', isPrimary: true },
          // Auto-offer is on by default: manual invite is the fallback, never
          // the default (docs/05, product rule 3).
          { name: 'auto_offer_enabled', type: 'boolean', default: true },
          { name: 'offer_window_days', type: 'integer', default: 7 },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    // Foreign keys, added after every table exists so ordering cannot bite.
    const foreignKeys: Array<{ table: string; key: TableForeignKey }> = [
      {
        table: 'waiting_list_entries',
        key: new TableForeignKey({
          name: 'FK_WAITING_LIST_ENTRIES_CLUB',
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'waiting_list_entries',
        key: new TableForeignKey({
          name: 'FK_WAITING_LIST_ENTRIES_PREFERRED_SQUAD',
          columnNames: ['preferred_squad_id'],
          referencedColumnNames: ['squad_id'],
          referencedTableName: 'squads',
          // A deleted squad must not delete the child from the list: the
          // preference simply stops applying.
          onDelete: 'SET NULL',
        }),
      },
      {
        table: 'waiting_list_entries',
        key: new TableForeignKey({
          name: 'FK_WAITING_LIST_ENTRIES_ENROLLED_MEMBER',
          columnNames: ['enrolled_member_id'],
          referencedColumnNames: ['member_id'],
          referencedTableName: 'members',
          onDelete: 'SET NULL',
        }),
      },
      {
        table: 'waiting_list_offers',
        key: new TableForeignKey({
          name: 'FK_WAITING_LIST_OFFERS_CLUB',
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'waiting_list_offers',
        key: new TableForeignKey({
          name: 'FK_WAITING_LIST_OFFERS_ENTRY',
          columnNames: ['entry_id'],
          referencedColumnNames: ['entry_id'],
          referencedTableName: 'waiting_list_entries',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'waiting_list_offers',
        key: new TableForeignKey({
          name: 'FK_WAITING_LIST_OFFERS_SQUAD',
          columnNames: ['squad_id'],
          referencedColumnNames: ['squad_id'],
          referencedTableName: 'squads',
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'waiting_list_settings',
        key: new TableForeignKey({
          name: 'FK_WAITING_LIST_SETTINGS_CLUB',
          columnNames: ['club_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clubs',
          onDelete: 'CASCADE',
        }),
      },
    ];

    for (const { table, key } of foreignKeys) {
      await queryRunner.createForeignKey(table, key);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping each table takes its own indices, unique constraints and
    // foreign keys with it, and the order below is child-before-parent.
    for (const table of CreateWaitingListTables1744204200000.TABLES) {
      if (await queryRunner.hasTable(table)) {
        await queryRunner.dropTable(table);
      }
    }
  }
}
