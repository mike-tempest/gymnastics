import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

/**
 * Post-signup activation email sequence support.
 *
 * Adds three sent-at stamps to clubs, one per activation email (day 2
 * "schedule sessions", day 5 "first register", day 10 "what stopped you?").
 * A non-null stamp means the email was handled for that club: either sent, or
 * deliberately suppressed because the club had already done the step. NULL
 * means not yet due or not yet processed, which preserves the behaviour of
 * every existing club (they are outside the send window anyway).
 *
 * Also creates email_suppressions: addresses that opted out of marketing and
 * nurture email. Transactional email (invoices, payment status, session
 * reminders) is unaffected by suppression.
 */
export class ActivationEmailsAndSuppressions1744203600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'activation_day2_sent_at',
      'activation_day5_sent_at',
      'activation_day10_sent_at',
    ]) {
      const exists = await queryRunner.hasColumn('clubs', column);
      if (!exists) {
        await queryRunner.addColumn(
          'clubs',
          new TableColumn({ name: column, type: 'timestamptz', isNullable: true }),
        );
      }
    }

    const tableExists = await queryRunner.hasTable('email_suppressions');
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'email_suppressions',
          columns: [
            {
              name: 'email',
              type: 'varchar',
              length: '255',
              isPrimary: true,
            },
            {
              name: 'reason',
              type: 'varchar',
              length: '50',
              default: "'unsubscribed'",
            },
            {
              name: 'created_at',
              type: 'timestamptz',
              default: 'now()',
            },
          ],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('email_suppressions');
    if (tableExists) {
      await queryRunner.dropTable('email_suppressions');
    }

    for (const column of [
      'activation_day10_sent_at',
      'activation_day5_sent_at',
      'activation_day2_sent_at',
    ]) {
      const exists = await queryRunner.hasColumn('clubs', column);
      if (exists) {
        await queryRunner.dropColumn('clubs', column);
      }
    }
  }
}
