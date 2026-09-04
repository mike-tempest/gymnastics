import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateFamiliesTable1703260300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create families table
    await queryRunner.createTable(
      new Table({
        name: 'families',
        columns: [
          {
            name: 'family_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'family_name',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'primary_contact_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'primary_contact_email',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'primary_contact_phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'address_line1',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'address_line2',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'city',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'postcode',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create index for family_name
    await queryRunner.createIndex(
      'families',
      new TableIndex({
        name: 'IDX_FAMILIES_FAMILY_NAME',
        columnNames: ['family_name'],
      }),
    );

    // Create index for primary_contact_email
    await queryRunner.createIndex(
      'families',
      new TableIndex({
        name: 'IDX_FAMILIES_PRIMARY_CONTACT_EMAIL',
        columnNames: ['primary_contact_email'],
      }),
    );

    // Clean up any invalid family_id references in swimmers table before adding foreign key
    await queryRunner.query(`
      UPDATE swimmers
      SET family_id = NULL
      WHERE family_id IS NOT NULL
      AND family_id NOT IN (SELECT family_id FROM families)
    `);

    // Add foreign key constraint from swimmers to families
    await queryRunner.createForeignKey(
      'swimmers',
      new TableForeignKey({
        name: 'FK_SWIMMERS_FAMILY',
        columnNames: ['family_id'],
        referencedTableName: 'families',
        referencedColumnNames: ['family_id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.dropForeignKey('swimmers', 'FK_SWIMMERS_FAMILY');

    // Drop indexes
    await queryRunner.dropIndex('families', 'IDX_FAMILIES_PRIMARY_CONTACT_EMAIL');
    await queryRunner.dropIndex('families', 'IDX_FAMILIES_FAMILY_NAME');

    // Drop families table
    await queryRunner.dropTable('families');
  }
}
