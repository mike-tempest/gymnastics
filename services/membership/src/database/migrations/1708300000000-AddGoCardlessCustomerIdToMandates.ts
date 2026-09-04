import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddGoCardlessCustomerIdToMandates1708300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'direct_debit_mandates',
      new TableColumn({
        name: 'gocardless_customer_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('direct_debit_mandates', 'gocardless_customer_id');
  }
}
