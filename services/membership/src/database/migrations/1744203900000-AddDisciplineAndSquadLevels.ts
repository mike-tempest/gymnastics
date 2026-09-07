import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Recreational level structure on squads (TEM-19) and the discipline attribute
 * on squads and members (TEM-20).
 *
 * A gym club is a wide recreational base plus a narrow competitive pathway, so
 * squads record which of the two they are, and recreational squads carry a
 * free-form level label. Disciplines follow the governing_body precedent: a
 * plain nullable varchar holding the TypeScript enum value, with no Postgres
 * enum type, so adding or renaming a discipline stays a code change rather
 * than a migration.
 *
 * programme_flags is jsonb holding a string array, matching the jsonb columns
 * already used elsewhere in the schema. A squad can serve more than one
 * participation programme (a pre-school parkour class, say).
 *
 * Every column is nullable with no default: existing rows stay untouched and
 * mean "not recorded", which is what an empty database and a club that has not
 * filled the fields in both want. squads and members are already covered by
 * row-level security, and adding a column to a covered table needs no new
 * policy.
 */
export class AddDisciplineAndSquadLevels1744203900000 implements MigrationInterface {
  private readonly squadColumns = [
    new TableColumn({ name: 'squad_type', type: 'varchar', length: '20', isNullable: true }),
    new TableColumn({ name: 'level', type: 'varchar', length: '100', isNullable: true }),
    new TableColumn({ name: 'discipline', type: 'varchar', length: '40', isNullable: true }),
    new TableColumn({ name: 'programme_flags', type: 'jsonb', isNullable: true }),
  ];

  private readonly memberColumns = [
    new TableColumn({ name: 'discipline', type: 'varchar', length: '40', isNullable: true }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.squadColumns) {
      if (!(await queryRunner.hasColumn('squads', column.name))) {
        await queryRunner.addColumn('squads', column);
      }
    }

    for (const column of this.memberColumns) {
      if (!(await queryRunner.hasColumn('members', column.name))) {
        await queryRunner.addColumn('members', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.memberColumns) {
      if (await queryRunner.hasColumn('members', column.name)) {
        await queryRunner.dropColumn('members', column.name);
      }
    }

    for (const column of this.squadColumns) {
      if (await queryRunner.hasColumn('squads', column.name)) {
        await queryRunner.dropColumn('squads', column.name);
      }
    }
  }
}
