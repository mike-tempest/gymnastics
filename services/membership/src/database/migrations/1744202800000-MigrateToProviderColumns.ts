import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Completes the move to provider-neutral identifier columns and drops the
 * GoCardless-specific ones.
 *
 * Migration 1744201500000 added provider_mandate_id / provider_customer_id /
 * provider_payment_id and back-filled them once, but no application code ever
 * wrote them afterwards, so every row created since has them NULL. They are not
 * merely dead, they have silently diverged. Hence step 1 re-backfills rather
 * than assuming the original backfill still holds.
 *
 * The unique constraint moves from gocardless_mandate_id to
 * (provider, provider_mandate_id). It stays GLOBAL rather than becoming
 * per-club: scoping it by club would let one provider mandate be attached to
 * two clubs, which is the cross-tenant billing bug this is meant to prevent.
 *
 * Safe to run against production, which holds 0 mandates and 0 payments. That
 * is precisely why this is being done now: the same change once clubs have live
 * mandates would be considerably less pleasant.
 */
export class MigrateToProviderColumns1744202800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-backfill. REQUIRED: rows created after 1744201500000 have NULL
    //    provider_* values, and step 3 would fail on them.
    await queryRunner.query(`
      UPDATE direct_debit_mandates
      SET provider_mandate_id = COALESCE(provider_mandate_id, gocardless_mandate_id),
          provider_customer_id = COALESCE(provider_customer_id, gocardless_customer_id),
          provider = COALESCE(provider, 'gocardless')
      WHERE provider_mandate_id IS NULL
         OR provider_customer_id IS NULL
         OR provider IS NULL
    `);

    await queryRunner.query(`
      UPDATE payments
      SET provider_payment_id = COALESCE(provider_payment_id, gocardless_payment_id),
          provider = COALESCE(provider, 'gocardless')
      WHERE provider_payment_id IS NULL
         OR provider IS NULL
    `);

    // 2. Drop the old GoCardless-specific unique constraint/index. The column
    //    was declared `unique: true`, which Postgres implements as a constraint
    //    whose name depends on how it was created, so discover it rather than
    //    guessing.
    const mandateUniques: { conname: string }[] = await queryRunner.query(`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
      WHERE rel.relname = 'direct_debit_mandates'
        AND con.contype = 'u'
        AND att.attname = 'gocardless_mandate_id'
    `);
    for (const { conname } of mandateUniques) {
      await queryRunner.query(
        `ALTER TABLE direct_debit_mandates DROP CONSTRAINT "${conname}"`,
      );
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_DIRECT_DEBIT_MANDATES_GOCARDLESS_ID"`);

    // 3. Make the provider-neutral mandate id authoritative.
    await queryRunner.query(
      `ALTER TABLE direct_debit_mandates ALTER COLUMN provider_mandate_id SET NOT NULL`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_MANDATES_PROVIDER_MANDATE_ID"
      ON direct_debit_mandates (provider, provider_mandate_id)
    `);
    // Payments: provider_payment_id stays nullable, because a manually recorded
    // payment (cash, bank transfer) has no provider payment. Partial index so
    // those NULLs do not collide with each other.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_PAYMENTS_PROVIDER_PAYMENT_ID"
      ON payments (provider, provider_payment_id)
      WHERE provider_payment_id IS NOT NULL
    `);

    // 4. Drop the GoCardless-specific columns.
    await queryRunner.query(
      `ALTER TABLE direct_debit_mandates DROP COLUMN IF EXISTS gocardless_mandate_id`,
    );
    await queryRunner.query(
      `ALTER TABLE direct_debit_mandates DROP COLUMN IF EXISTS gocardless_customer_id`,
    );
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS gocardless_payment_id`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the columns and copy the values back, so a rollback keeps every
    // mandate chargeable rather than orphaning it from its provider.
    await queryRunner.query(
      `ALTER TABLE direct_debit_mandates ADD COLUMN IF NOT EXISTS gocardless_mandate_id varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE direct_debit_mandates ADD COLUMN IF NOT EXISTS gocardless_customer_id varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gocardless_payment_id varchar(255)`,
    );

    // Only GoCardless rows can be represented in GoCardless-specific columns; a
    // Stripe mandate has no meaningful gocardless_mandate_id.
    await queryRunner.query(`
      UPDATE direct_debit_mandates
      SET gocardless_mandate_id = provider_mandate_id,
          gocardless_customer_id = provider_customer_id
      WHERE provider = 'gocardless'
    `);
    await queryRunner.query(`
      UPDATE payments
      SET gocardless_payment_id = provider_payment_id
      WHERE provider = 'gocardless'
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_PAYMENTS_PROVIDER_PAYMENT_ID"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_MANDATES_PROVIDER_MANDATE_ID"`);
    await queryRunner.query(
      `ALTER TABLE direct_debit_mandates ALTER COLUMN provider_mandate_id DROP NOT NULL`,
    );

    // Restoring the old global unique on gocardless_mandate_id is only possible
    // if every row is GoCardless. If a Stripe mandate exists its NULL would not
    // conflict (Postgres allows multiple NULLs in a unique index), so this is
    // safe either way.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_DIRECT_DEBIT_MANDATES_GOCARDLESS_ID"
      ON direct_debit_mandates (gocardless_mandate_id)
    `);
  }
}
