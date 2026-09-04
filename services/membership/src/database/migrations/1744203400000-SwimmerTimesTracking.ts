import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

/**
 * Swimmer times tracking.
 *
 * - competition_results gains a per-result course (SC/LC) so times can be
 *   compared correctly across pools; backfilled from the parent competition.
 * - competition_results gains relay support: is_relay plus relay_legs jsonb
 *   holding an ordered array of { leg, swimmer_id, name, split }.
 * - competition_entries gains age_group, which the meet-file parsers already
 *   produce but previously dropped.
 * - competitions gains qualifying_times jsonb: an array of
 *   { distance, stroke, time } consideration standards for the meet, checked
 *   against entry times in the UI.
 * - New personal_bests table: one row per swimmer/distance/stroke/course
 *   holding the fastest non-DQ individual time, referencing the result that
 *   set it. Backfilled from existing results.
 * - is_pb on competition_results is recomputed historically: a result is
 *   flagged when it beat every earlier result for the same swimmer, event and
 *   course (ordered by meet start date, then row creation).
 */
export class SwimmerTimesTracking1744203400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- competition_results: course + relay ---
    const resultColumns: TableColumn[] = [
      new TableColumn({ name: 'course', type: 'varchar', length: '10', isNullable: true }),
      new TableColumn({ name: 'is_relay', type: 'boolean', default: false }),
      new TableColumn({ name: 'relay_legs', type: 'jsonb', isNullable: true }),
    ];
    for (const column of resultColumns) {
      const exists = await queryRunner.hasColumn('competition_results', column.name);
      if (!exists) {
        await queryRunner.addColumn('competition_results', column);
      }
    }

    // Backfill result course from the parent competition.
    await queryRunner.query(`
      UPDATE competition_results r
      SET course = c.course
      FROM competitions c
      WHERE r.competition_id = c.competition_id
        AND r.course IS NULL
    `);

    // --- competition_entries: age_group ---
    const hasAgeGroup = await queryRunner.hasColumn('competition_entries', 'age_group');
    if (!hasAgeGroup) {
      await queryRunner.addColumn(
        'competition_entries',
        new TableColumn({ name: 'age_group', type: 'varchar', length: '50', isNullable: true }),
      );
    }

    // --- competitions: qualifying_times ---
    const hasQualifyingTimes = await queryRunner.hasColumn('competitions', 'qualifying_times');
    if (!hasQualifyingTimes) {
      await queryRunner.addColumn(
        'competitions',
        new TableColumn({ name: 'qualifying_times', type: 'jsonb', isNullable: true }),
      );
    }

    // --- personal_bests table ---
    const hasTable = await queryRunner.hasTable('personal_bests');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'personal_bests',
          columns: [
            {
              name: 'pb_id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'club_id', type: 'uuid', isNullable: true },
            { name: 'swimmer_id', type: 'uuid' },
            { name: 'distance', type: 'int' },
            { name: 'stroke', type: 'varchar', length: '50' },
            { name: 'course', type: 'varchar', length: '10' },
            { name: 'time', type: 'decimal', precision: 8, scale: 2 },
            { name: 'result_id', type: 'uuid', isNullable: true },
            { name: 'achieved_at', type: 'date', isNullable: true },
            { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'personal_bests',
        new TableIndex({
          name: 'IDX_PERSONAL_BESTS_SWIMMER_ID',
          columnNames: ['swimmer_id'],
        }),
      );
      await queryRunner.createIndex(
        'personal_bests',
        new TableIndex({
          name: 'IDX_PERSONAL_BESTS_CLUB_ID',
          columnNames: ['club_id'],
        }),
      );
      await queryRunner.createIndex(
        'personal_bests',
        new TableIndex({
          name: 'UQ_PERSONAL_BESTS_SWIMMER_EVENT',
          columnNames: ['swimmer_id', 'distance', 'stroke', 'course'],
          isUnique: true,
        }),
      );

      await queryRunner.createForeignKey(
        'personal_bests',
        new TableForeignKey({
          columnNames: ['swimmer_id'],
          referencedTableName: 'swimmers',
          referencedColumnNames: ['swimmer_id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'personal_bests',
        new TableForeignKey({
          columnNames: ['result_id'],
          referencedTableName: 'competition_results',
          referencedColumnNames: ['result_id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    // Backfill personal_bests from existing individual, non-DQ results.
    await queryRunner.query(`
      INSERT INTO personal_bests (club_id, swimmer_id, distance, stroke, course, time, result_id, achieved_at)
      SELECT DISTINCT ON (r.swimmer_id, r.distance, r.stroke, r.course)
        r.club_id, r.swimmer_id, r.distance, r.stroke, r.course, r.time, r.result_id, c.start_date
      FROM competition_results r
      JOIN competitions c ON c.competition_id = r.competition_id
      WHERE r.dq = false AND r.time > 0 AND r.is_relay = false AND r.course IS NOT NULL
      ORDER BY r.swimmer_id, r.distance, r.stroke, r.course, r.time ASC, c.start_date ASC
      ON CONFLICT DO NOTHING
    `);

    // Recompute historical is_pb flags: a result is a PB when it is strictly
    // faster than every earlier result for the same swimmer/event/course.
    await queryRunner.query(`
      UPDATE competition_results r
      SET is_pb = sub.is_pb
      FROM (
        SELECT
          r2.result_id,
          (
            r2.dq = false AND r2.time > 0 AND r2.is_relay = false
            AND r2.time < COALESCE((
              SELECT MIN(prev.time)
              FROM competition_results prev
              JOIN competitions pc ON pc.competition_id = prev.competition_id
              WHERE prev.swimmer_id = r2.swimmer_id
                AND prev.distance = r2.distance
                AND prev.stroke = r2.stroke
                AND prev.course IS NOT DISTINCT FROM r2.course
                AND prev.dq = false AND prev.time > 0 AND prev.is_relay = false
                AND (pc.start_date, prev.created_at) < (c2.start_date, r2.created_at)
            ), 999999)
          ) AS is_pb
        FROM competition_results r2
        JOIN competitions c2 ON c2.competition_id = r2.competition_id
      ) sub
      WHERE r.result_id = sub.result_id AND r.is_pb IS DISTINCT FROM sub.is_pb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('personal_bests');
    if (hasTable) {
      await queryRunner.dropTable('personal_bests');
    }

    const hasQualifyingTimes = await queryRunner.hasColumn('competitions', 'qualifying_times');
    if (hasQualifyingTimes) {
      await queryRunner.dropColumn('competitions', 'qualifying_times');
    }

    const hasAgeGroup = await queryRunner.hasColumn('competition_entries', 'age_group');
    if (hasAgeGroup) {
      await queryRunner.dropColumn('competition_entries', 'age_group');
    }

    for (const name of ['relay_legs', 'is_relay', 'course']) {
      const exists = await queryRunner.hasColumn('competition_results', name);
      if (exists) {
        await queryRunner.dropColumn('competition_results', name);
      }
    }
  }
}
