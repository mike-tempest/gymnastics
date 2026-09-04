import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateUsersTableForAuth1703261100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');

    // Add active column if it doesn't exist
    const activeColumn = table?.findColumnByName('active');
    if (!activeColumn) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'active',
          type: 'boolean',
          default: true,
        }),
      );
    }

    // Add family_id column if it doesn't exist
    const familyIdColumn = table?.findColumnByName('family_id');
    if (!familyIdColumn) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'family_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    // Add last_login column if it doesn't exist
    const lastLoginColumn = table?.findColumnByName('last_login');
    if (!lastLoginColumn) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'last_login',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }

    // Drop club_id column if it exists
    const clubIdColumn = table?.findColumnByName('club_id');
    if (clubIdColumn) {
      const indices = await queryRunner.getTable('users');
      const clubIdIndex = indices?.indices.find((idx) => idx.name === 'IDX_USERS_CLUB_ID');
      if (clubIdIndex) {
        await queryRunner.dropIndex('users', 'IDX_USERS_CLUB_ID');
      }
      await queryRunner.dropColumn('users', 'club_id');
    }

    // Update role column to use enum values
    await queryRunner.query(`
      ALTER TABLE users
      ALTER COLUMN role TYPE varchar(20),
      ALTER COLUMN role SET DEFAULT 'PARENT'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove added columns
    await queryRunner.dropColumn('users', 'last_login');
    await queryRunner.dropColumn('users', 'family_id');
    await queryRunner.dropColumn('users', 'active');

    // Restore club_id column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'club_id',
        type: 'uuid',
      }),
    );

    // Restore role column
    await queryRunner.query(`
      ALTER TABLE users 
      ALTER COLUMN role TYPE varchar(50),
      ALTER COLUMN role SET DEFAULT 'parent'
    `);
  }
}
