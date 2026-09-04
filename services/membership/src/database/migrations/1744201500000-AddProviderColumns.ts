import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Payments regionalisation: introduce provider-neutral columns alongside the
 * existing GoCardless-specific ones, so a payment provider abstraction can route
 * mandates and payments through different providers in future.
 *
 * Nothing changes for existing clubs:
 *  - `provider` is NOT NULL with default 'gocardless', so every existing row is
 *    back-filled to GoCardless.
 *  - The provider-neutral id columns are back-filled from the matching
 *    gocardless_* columns.
 *  - The existing gocardless_* columns are kept untouched.
 *
 * direct_debit_mandates:
 *   provider              varchar NOT NULL default 'gocardless'
 *   provider_mandate_id   varchar NULL   (back-filled from gocardless_mandate_id)
 *   provider_customer_id  varchar NULL   (back-filled from gocardless_customer_id)
 *
 * payments:
 *   provider              varchar NOT NULL default 'gocardless'
 *   provider_payment_id   varchar NULL   (back-filled from gocardless_payment_id)
 *
 * Each add is guarded with hasColumn so the migration is idempotent, and down()
 * drops only the columns this migration introduced.
 */
export class AddProviderColumns1744201500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- direct_debit_mandates ------------------------------------------------
    const hasMandateProvider = await queryRunner.hasColumn('direct_debit_mandates', 'provider');
    if (!hasMandateProvider) {
      await queryRunner.addColumn(
        'direct_debit_mandates',
        new TableColumn({
          name: 'provider',
          type: 'varchar',
          length: '50',
          isNullable: false,
          default: "'gocardless'",
        }),
      );
    }

    const hasMandateProviderId = await queryRunner.hasColumn(
      'direct_debit_mandates',
      'provider_mandate_id',
    );
    if (!hasMandateProviderId) {
      await queryRunner.addColumn(
        'direct_debit_mandates',
        new TableColumn({
          name: 'provider_mandate_id',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
      // Back-fill from the existing GoCardless mandate id.
      await queryRunner.query(
        `UPDATE "direct_debit_mandates" SET "provider_mandate_id" = "gocardless_mandate_id" WHERE "provider_mandate_id" IS NULL`,
      );
    }

    const hasMandateCustomerId = await queryRunner.hasColumn(
      'direct_debit_mandates',
      'provider_customer_id',
    );
    if (!hasMandateCustomerId) {
      await queryRunner.addColumn(
        'direct_debit_mandates',
        new TableColumn({
          name: 'provider_customer_id',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
      // Back-fill from the existing GoCardless customer id.
      await queryRunner.query(
        `UPDATE "direct_debit_mandates" SET "provider_customer_id" = "gocardless_customer_id" WHERE "provider_customer_id" IS NULL`,
      );
    }

    // --- payments -------------------------------------------------------------
    const hasPaymentProvider = await queryRunner.hasColumn('payments', 'provider');
    if (!hasPaymentProvider) {
      await queryRunner.addColumn(
        'payments',
        new TableColumn({
          name: 'provider',
          type: 'varchar',
          length: '50',
          isNullable: false,
          default: "'gocardless'",
        }),
      );
    }

    const hasPaymentProviderId = await queryRunner.hasColumn('payments', 'provider_payment_id');
    if (!hasPaymentProviderId) {
      await queryRunner.addColumn(
        'payments',
        new TableColumn({
          name: 'provider_payment_id',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
      // Back-fill from the existing GoCardless payment id.
      await queryRunner.query(
        `UPDATE "payments" SET "provider_payment_id" = "gocardless_payment_id" WHERE "provider_payment_id" IS NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasPaymentProviderId = await queryRunner.hasColumn('payments', 'provider_payment_id');
    if (hasPaymentProviderId) {
      await queryRunner.dropColumn('payments', 'provider_payment_id');
    }

    const hasPaymentProvider = await queryRunner.hasColumn('payments', 'provider');
    if (hasPaymentProvider) {
      await queryRunner.dropColumn('payments', 'provider');
    }

    const hasMandateCustomerId = await queryRunner.hasColumn(
      'direct_debit_mandates',
      'provider_customer_id',
    );
    if (hasMandateCustomerId) {
      await queryRunner.dropColumn('direct_debit_mandates', 'provider_customer_id');
    }

    const hasMandateProviderId = await queryRunner.hasColumn(
      'direct_debit_mandates',
      'provider_mandate_id',
    );
    if (hasMandateProviderId) {
      await queryRunner.dropColumn('direct_debit_mandates', 'provider_mandate_id');
    }

    const hasMandateProvider = await queryRunner.hasColumn('direct_debit_mandates', 'provider');
    if (hasMandateProvider) {
      await queryRunner.dropColumn('direct_debit_mandates', 'provider');
    }
  }
}
