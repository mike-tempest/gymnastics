import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAwardSkills1789800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE award_levels ADD COLUMN next_level_id uuid;
      CREATE UNIQUE INDEX award_levels_club_level_key ON award_levels(club_id,level_id);
      ALTER TABLE award_levels ADD CONSTRAINT award_next_level_fk FOREIGN KEY(club_id,next_level_id) REFERENCES award_levels(club_id,level_id);
      CREATE TABLE award_criteria (
        criterion_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), club_id uuid NOT NULL REFERENCES clubs(id),
        level_id uuid NOT NULL, name varchar(200) NOT NULL, guidance text,
        sort_order integer NOT NULL DEFAULT 0, required boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT true,
        version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(club_id,criterion_id), FOREIGN KEY(club_id,level_id) REFERENCES award_levels(club_id,level_id)
      );
      CREATE INDEX award_criteria_level_idx ON award_criteria(club_id,level_id,sort_order);
      CREATE TABLE award_skill_progress (
        club_id uuid NOT NULL REFERENCES clubs(id), member_id uuid NOT NULL REFERENCES members(member_id),
        criterion_id uuid NOT NULL, status varchar(20) NOT NULL CHECK(status IN ('working_towards','achieved')),
        version integer NOT NULL DEFAULT 1, assessed_on date NOT NULL, parent_note text,
        PRIMARY KEY(club_id,member_id,criterion_id),
        FOREIGN KEY(club_id,criterion_id) REFERENCES award_criteria(club_id,criterion_id)
      );
      CREATE TABLE award_skill_assessments (
        assessment_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), club_id uuid NOT NULL REFERENCES clubs(id),
        member_id uuid NOT NULL REFERENCES members(member_id), criterion_id uuid NOT NULL,
        criterion_name varchar(200) NOT NULL, criterion_guidance text,
        status varchar(20) NOT NULL CHECK(status IN ('working_towards','achieved')),
        assessed_on date NOT NULL, assessed_by_user_id uuid REFERENCES users(user_id),
        session_id uuid REFERENCES sessions(session_id), internal_note text, parent_note text,
        progress_version integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY(club_id,criterion_id) REFERENCES award_criteria(club_id,criterion_id)
      );
      CREATE INDEX award_skill_history_idx ON award_skill_assessments(club_id,member_id,created_at DESC);
      CREATE TABLE award_requests (
        club_id uuid NOT NULL REFERENCES clubs(id), request_key uuid NOT NULL,
        fingerprint varchar(64) NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(club_id,request_key)
      );
      CREATE TABLE award_invoice_sources (
        club_id uuid NOT NULL REFERENCES clubs(id), member_id uuid NOT NULL REFERENCES members(member_id),
        level_id uuid NOT NULL, invoice_id uuid NOT NULL REFERENCES invoices(invoice_id),
        PRIMARY KEY(club_id,member_id,level_id),
        FOREIGN KEY(club_id,level_id) REFERENCES award_levels(club_id,level_id)
      );
      INSERT INTO award_invoice_sources(club_id,member_id,level_id,invoice_id)
        SELECT club_id,member_id,level_id,invoice_id FROM member_award_progress WHERE invoice_id IS NOT NULL;
      CREATE FUNCTION preserve_award_skill_history() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Skill assessment history is immutable'; END $$;
      CREATE TRIGGER immutable_award_skill_history BEFORE UPDATE OR DELETE ON award_skill_assessments
        FOR EACH ROW EXECUTE FUNCTION preserve_award_skill_history();
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE award_invoice_sources, award_requests, award_skill_assessments, award_skill_progress, award_criteria;
      DROP FUNCTION preserve_award_skill_history();
      ALTER TABLE award_levels DROP CONSTRAINT award_next_level_fk;
      ALTER TABLE award_levels DROP COLUMN next_level_id;
      DROP INDEX award_levels_club_level_key;
    `);
  }
}
