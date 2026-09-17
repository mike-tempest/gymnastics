import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordRecovery1789657200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE users ADD COLUMN session_version integer NOT NULL DEFAULT 0',
    );
    await queryRunner.query('ALTER TABLE users ADD COLUMN password_reset_hash varchar(64)');
    await queryRunner.query('ALTER TABLE users ADD COLUMN password_reset_expires_at timestamptz');
    await queryRunner.query('ALTER TABLE users ADD COLUMN password_reset_requested_at timestamptz');
    await queryRunner.query(`CREATE UNIQUE INDEX users_password_reset_hash_idx
      ON users (password_reset_hash) WHERE password_reset_hash IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX users_password_reset_hash_idx');
    await queryRunner.query('ALTER TABLE users DROP COLUMN password_reset_requested_at');
    await queryRunner.query('ALTER TABLE users DROP COLUMN password_reset_expires_at');
    await queryRunner.query('ALTER TABLE users DROP COLUMN password_reset_hash');
    await queryRunner.query('ALTER TABLE users DROP COLUMN session_version');
  }
}
