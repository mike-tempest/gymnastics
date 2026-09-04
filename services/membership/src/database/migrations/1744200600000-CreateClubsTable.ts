import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Phase 1 (1/4): Create the tenant root table `clubs`.
 *
 * Every tenant-owned table will carry a club_id referencing clubs(id). This
 * migration only creates the table; columns, backfill and constraints follow
 * in the next three migrations.
 */
export class CreateClubsTable1744200600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'clubs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'swim_england_region',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'swim_england_affiliate_number',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'county',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'contact_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'website',
            type: 'varchar',
            length: '512',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'active'",
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'clubs',
      new TableIndex({
        name: 'IDX_CLUBS_SLUG',
        columnNames: ['slug'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('clubs', 'IDX_CLUBS_SLUG');
    await queryRunner.dropTable('clubs');
  }
}
