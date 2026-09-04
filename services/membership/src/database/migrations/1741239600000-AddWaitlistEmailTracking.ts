import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWaitlistEmailTracking1741239600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('waitlist', [
      new TableColumn({
        name: 'name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'confirmationSentAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'drip1SentAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'drip2SentAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'drip3SentAt',
        type: 'timestamp',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('waitlist', 'drip3SentAt');
    await queryRunner.dropColumn('waitlist', 'drip2SentAt');
    await queryRunner.dropColumn('waitlist', 'drip1SentAt');
    await queryRunner.dropColumn('waitlist', 'confirmationSentAt');
    await queryRunner.dropColumn('waitlist', 'name');
  }
}
