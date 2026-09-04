import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds failure-reason columns to payments so a failed collection records WHY
 * it failed, not just that it did.
 *
 * failure_cause stores GoCardless's normalised, machine-readable cause from
 * the webhook event details (e.g. insufficient_funds, refer_to_payer,
 * bank_account_closed). It is scheme-neutral: Bacs and BECS failures both
 * arrive normalised to the same vocabulary, which is what payer-facing copy
 * is keyed on.
 *
 * failure_description stores GoCardless's human-readable sentence for the
 * same event, kept as a fallback for causes we have no bespoke copy for and
 * for admin display.
 *
 * Both stay NULL for successful payments and for all existing rows, so
 * nothing changes for payments that never failed.
 */
export class AddFailureReasonToPayments1744203300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: TableColumn[] = [
      new TableColumn({
        name: 'failure_cause',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'failure_description',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      const exists = await queryRunner.hasColumn('payments', column.name);
      if (!exists) {
        await queryRunner.addColumn('payments', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['failure_description', 'failure_cause']) {
      const exists = await queryRunner.hasColumn('payments', name);
      if (exists) {
        await queryRunner.dropColumn('payments', name);
      }
    }
  }
}
