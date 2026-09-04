import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateFamilyInvitesTable1703261300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'family_invites',
        columns: [
          {
            name: 'invite_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'family_id',
            type: 'uuid',
          },
          {
            name: 'token',
            type: 'varchar',
            length: '64',
            isUnique: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Index on token for fast lookups
    await queryRunner.createIndex(
      'family_invites',
      new TableIndex({
        name: 'IDX_FAMILY_INVITES_TOKEN',
        columnNames: ['token'],
        isUnique: true,
      }),
    );

    // Foreign key to families table
    await queryRunner.createForeignKey(
      'family_invites',
      new TableForeignKey({
        name: 'FK_FAMILY_INVITES_FAMILY',
        columnNames: ['family_id'],
        referencedTableName: 'families',
        referencedColumnNames: ['family_id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('family_invites', 'FK_FAMILY_INVITES_FAMILY');
    await queryRunner.dropIndex('family_invites', 'IDX_FAMILY_INVITES_TOKEN');
    await queryRunner.dropTable('family_invites');
  }
}
