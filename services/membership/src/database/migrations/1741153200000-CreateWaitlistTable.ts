import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWaitlistTable1741153200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'waitlist',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'clubName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'role',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'source',
            type: 'varchar',
            length: '100',
            default: "'website'",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'waitlist',
      new TableIndex({
        name: 'IDX_waitlist_email_unique',
        columnNames: ['email'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('waitlist', 'IDX_waitlist_email_unique');
    await queryRunner.dropTable('waitlist');
  }
}
