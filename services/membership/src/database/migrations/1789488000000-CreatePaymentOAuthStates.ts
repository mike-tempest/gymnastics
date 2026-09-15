import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentOAuthStates1789488000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE payment_oauth_states (
      state_hash varchar(64) PRIMARY KEY,
      club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      livemode boolean NOT NULL,
      redirect_uri text NOT NULL,
      expires_at timestamptz NOT NULL
    )`);
    await q.query('CREATE INDEX ON payment_oauth_states (expires_at)');
    await q.query(`CREATE TABLE gocardless_webhook_receipts (
      event_id varchar(255) PRIMARY KEY,
      club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      processed_at timestamptz NOT NULL DEFAULT now()
    )`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE gocardless_webhook_receipts');
    await q.query('DROP TABLE payment_oauth_states');
  }
}
