import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInviteFieldsToFamilies1744200400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'families',
      new TableColumn({
        name: 'invite_token',
        type: 'varchar',
        length: '255',
        isNullable: true,
        isUnique: true,
      }),
    );

    await queryRunner.addColumn(
      'families',
      new TableColumn({
        name: 'invite_status',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'families',
      new TableColumn({
        name: 'invited_at',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'families',
      new TableColumn({
        name: 'invite_accepted_at',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('families', 'invite_accepted_at');
    await queryRunner.dropColumn('families', 'invited_at');
    await queryRunner.dropColumn('families', 'invite_status');
    await queryRunner.dropColumn('families', 'invite_token');
  }
}
