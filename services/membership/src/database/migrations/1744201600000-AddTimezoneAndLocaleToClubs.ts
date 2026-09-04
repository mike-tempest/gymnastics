import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * International expansion, regional foundation: give every club an IANA
 * timezone and a BCP 47 locale so dates, times, and formats can be rendered
 * in the club's own region rather than assuming the UK.
 *
 * Both columns are NOT NULL with UK defaults (Europe/London, en-GB), so every
 * existing row is back-filled to the previous UK-only behaviour and nothing
 * changes for current clubs. Each add is guarded with hasColumn so the
 * migration is idempotent.
 *
 *  - clubs.timezone  IANA timezone name, default Europe/London
 *  - clubs.locale    BCP 47 locale, default en-GB
 */
export class AddTimezoneAndLocaleToClubs1744201600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTimezone = await queryRunner.hasColumn('clubs', 'timezone');
    if (!hasTimezone) {
      await queryRunner.addColumn(
        'clubs',
        new TableColumn({
          name: 'timezone',
          type: 'varchar',
          length: '64',
          isNullable: false,
          default: "'Europe/London'",
        }),
      );
    }

    const hasLocale = await queryRunner.hasColumn('clubs', 'locale');
    if (!hasLocale) {
      await queryRunner.addColumn(
        'clubs',
        new TableColumn({
          name: 'locale',
          type: 'varchar',
          length: '10',
          isNullable: false,
          default: "'en-GB'",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasLocale = await queryRunner.hasColumn('clubs', 'locale');
    if (hasLocale) {
      await queryRunner.dropColumn('clubs', 'locale');
    }

    const hasTimezone = await queryRunner.hasColumn('clubs', 'timezone');
    if (hasTimezone) {
      await queryRunner.dropColumn('clubs', 'timezone');
    }
  }
}
