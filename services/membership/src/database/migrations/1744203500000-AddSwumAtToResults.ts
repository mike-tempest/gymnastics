import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds swum_at to competition_results: the date the time was actually swum,
 * when it differs from the parent competition's start date. Used by the CSV
 * baseline-times import, where one "Baseline" competition holds times achieved
 * at many different past dates. NULL means "swum on the competition's date",
 * which preserves the behaviour of every existing row.
 */
export class AddSwumAtToResults1744203500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasColumn('competition_results', 'swum_at');
    if (!exists) {
      await queryRunner.addColumn(
        'competition_results',
        new TableColumn({ name: 'swum_at', type: 'date', isNullable: true }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasColumn('competition_results', 'swum_at');
    if (exists) {
      await queryRunner.dropColumn('competition_results', 'swum_at');
    }
  }
}
