import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Creates club_payment_connections: a club's connection to ITS OWN payment
 * provider account.
 *
 * This is the storage behind moving off "Swimly is the merchant of record"
 * (one shared GoCardless account for every club) and onto connected accounts,
 * where funds move between the payer and the club's own account.
 *
 * No club credentials are stored. Stripe Connect authenticates with the
 * platform key plus external_account_id, so there is no per-club secret. The
 * access_token_encrypted / encryption_key_id columns are created unused, for
 * GoCardless Partner OAuth, which does issue a per-merchant bearer token. They
 * are added now so that phase does not need to alter a table that by then holds
 * live rows.
 *
 * Additive only: creates one new table and touches nothing existing.
 */
export class CreateClubPaymentConnections1744202700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'club_payment_connections',
        columns: [
          {
            name: 'connection_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          { name: 'provider', type: 'varchar', length: '50' },
          { name: 'external_account_id', type: 'varchar', length: '255' },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'active', 'restricted', 'disconnected'],
            default: "'pending'",
          },
          { name: 'capabilities', type: 'jsonb', default: "'{}'" },
          { name: 'livemode', type: 'boolean', default: false },
          { name: 'access_token_encrypted', type: 'text', isNullable: true },
          { name: 'encryption_key_id', type: 'varchar', length: '64', isNullable: true },
          { name: 'connected_at', type: 'timestamp', isNullable: true },
          { name: 'disconnected_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'club_payment_connections',
      new TableForeignKey({
        columnNames: ['club_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'clubs',
        onDelete: 'CASCADE',
        name: 'FK_CLUB_PAYMENT_CONNECTIONS_CLUB',
      }),
    );

    await queryRunner.createIndex(
      'club_payment_connections',
      new TableIndex({
        name: 'IDX_CLUB_PAYMENT_CONNECTIONS_CLUB_ID',
        columnNames: ['club_id'],
      }),
    );

    // How an inbound webhook is routed back to a club: the provider tells us
    // which account an event belongs to, and this resolves it. Unique so one
    // provider account can never be claimed by two clubs, which would be a
    // cross-tenant billing bug.
    await queryRunner.createIndex(
      'club_payment_connections',
      new TableIndex({
        name: 'UQ_CLUB_PAYMENT_CONNECTIONS_PROVIDER_ACCOUNT',
        columnNames: ['provider', 'external_account_id'],
        isUnique: true,
      }),
    );

    // One row per club per provider, so reconnecting updates in place rather
    // than accumulating dead rows.
    await queryRunner.createIndex(
      'club_payment_connections',
      new TableIndex({
        name: 'UQ_CLUB_PAYMENT_CONNECTIONS_CLUB_PROVIDER',
        columnNames: ['club_id', 'provider'],
        isUnique: true,
      }),
    );

    // A club has at most ONE live provider at a time. Enforced as a partial
    // unique index because the constraint only applies to active rows: a club
    // may keep a disconnected Stripe row alongside an active GoCardless one.
    // TypeORM's TableIndex has no partial-index support, so this is raw SQL.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_CLUB_PAYMENT_CONNECTIONS_ONE_ACTIVE"
      ON club_payment_connections (club_id)
      WHERE status = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_CLUB_PAYMENT_CONNECTIONS_ONE_ACTIVE"`);
    await queryRunner.dropIndex(
      'club_payment_connections',
      'UQ_CLUB_PAYMENT_CONNECTIONS_CLUB_PROVIDER',
    );
    await queryRunner.dropIndex(
      'club_payment_connections',
      'UQ_CLUB_PAYMENT_CONNECTIONS_PROVIDER_ACCOUNT',
    );
    await queryRunner.dropIndex('club_payment_connections', 'IDX_CLUB_PAYMENT_CONNECTIONS_CLUB_ID');
    await queryRunner.dropForeignKey(
      'club_payment_connections',
      'FK_CLUB_PAYMENT_CONNECTIONS_CLUB',
    );
    await queryRunner.dropTable('club_payment_connections');
  }
}
