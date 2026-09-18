import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecurringTimetables1789600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE timetable_terms (
        term_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        club_id uuid NOT NULL REFERENCES clubs(id),
        name varchar(200) NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL CHECK (end_date >= start_date),
        timezone varchar(100) NOT NULL,
        source_term_id uuid,
        UNIQUE (term_id, club_id),
        UNIQUE (club_id, source_term_id, start_date, end_date),
        FOREIGN KEY (source_term_id, club_id) REFERENCES timetable_terms(term_id, club_id)
      );
      CREATE TABLE session_series (
        series_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        club_id uuid NOT NULL REFERENCES clubs(id),
        term_id uuid NOT NULL,
        definition jsonb NOT NULL,
        UNIQUE (series_id, club_id),
        FOREIGN KEY (term_id, club_id) REFERENCES timetable_terms(term_id, club_id)
      );
      CREATE INDEX session_series_term ON session_series(club_id, term_id);
      ALTER TABLE sessions ADD COLUMN series_id uuid;
      ALTER TABLE sessions ADD COLUMN occurrence_date date;
      ALTER TABLE sessions ADD COLUMN is_override boolean NOT NULL DEFAULT false;
      ALTER TABLE sessions ADD COLUMN cancellation_reason varchar(200);
      ALTER TABLE sessions ADD CONSTRAINT sessions_series_club FOREIGN KEY (series_id, club_id)
          REFERENCES session_series(series_id, club_id),
        ADD CONSTRAINT sessions_occurrence UNIQUE(series_id, occurrence_date),
        ADD CONSTRAINT sessions_occurrence_pair CHECK ((series_id IS NULL) = (occurrence_date IS NULL));
      CREATE TABLE timetable_operations (
        club_id uuid NOT NULL REFERENCES clubs(id),
        operation_id uuid NOT NULL,
        request_hash text NOT NULL,
        result jsonb NOT NULL,
        PRIMARY KEY(club_id, operation_id)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE timetable_operations;
      ALTER TABLE sessions DROP CONSTRAINT sessions_occurrence_pair,
        DROP CONSTRAINT sessions_occurrence, DROP CONSTRAINT sessions_series_club,
        DROP COLUMN cancellation_reason, DROP COLUMN is_override,
        DROP COLUMN occurrence_date, DROP COLUMN series_id;
      DROP TABLE session_series;
      DROP TABLE timetable_terms;
    `);
  }
}
