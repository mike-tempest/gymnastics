import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationDeliveries1789690000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE notification_deliveries (
      delivery_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      source_type text NOT NULL CHECK (source_type IN ('broadcast','session_cancellation')),
      source_id uuid NOT NULL, event_key text NOT NULL, kind text NOT NULL,
      recipient_name text NOT NULL, recipient_email text, recipient_user_id uuid, family_id uuid,
      subject text NOT NULL, body text NOT NULL,
      status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','provider_accepted','delivered','failed','suppressed')),
      attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
      first_attempt_at timestamptz, lease_token uuid, lease_until timestamptz,
      provider_id text, last_error text, sent_at timestamptz, delivered_at timestamptz,
      follow_up_note text, followed_up_at timestamptz, followed_up_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,event_key)
    )`);
    await queryRunner.query(
      `CREATE INDEX notification_deliveries_due ON notification_deliveries(available_at) WHERE status IN ('queued','sending')`,
    );
    await queryRunner.query(
      `CREATE INDEX notification_deliveries_source ON notification_deliveries(club_id,source_type,source_id,created_at)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX notification_deliveries_provider ON notification_deliveries(provider_id) WHERE provider_id IS NOT NULL`,
    );
    await queryRunner.query(`CREATE TABLE notification_delivery_events (
      provider_id text PRIMARY KEY, status text NOT NULL CHECK (status IN ('delivered','failed','suppressed')),
      received_at timestamptz NOT NULL DEFAULT now()
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE notification_delivery_events');
    await queryRunner.query('DROP TABLE notification_deliveries');
  }
}
