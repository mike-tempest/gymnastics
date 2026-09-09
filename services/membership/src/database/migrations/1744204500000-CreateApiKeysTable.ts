import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Club-scoped read API keys (TEM-32).
 *
 * A club owns its data and must be able to read it out without asking us, so
 * an admin can mint a key that authenticates the read API. Storage rules
 * baked into this schema:
 *
 *  - `key_hash` holds a SHA-256 digest of the secret half of the credential,
 *    never the credential itself. The secret is 256 bits of CSPRNG output, so
 *    it has no brute-forceable structure the way a chosen password does and a
 *    deliberately slow KDF would only tax every API request. This is the same
 *    trade-off GitHub and Stripe make for machine tokens.
 *  - `key_prefix` is the non-secret half. It is what the UI displays, what
 *    the guard looks a key up by, and what the rate limiter buckets on, so it
 *    is unique and indexed. It is safe to log.
 *  - Revocation sets `revoked_at` rather than deleting the row, so the audit
 *    trail of what once had access to a club survives.
 *
 * Row-level security for this table lands in the next migration, matching how
 * the awards and waiting-list tables were done.
 */
export class CreateApiKeysTable1744204500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'api_keys',
        columns: [
          {
            name: 'api_key_id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'club_id', type: 'uuid' },
          // Non-secret lookup and display identifier, for example
          // "gymk_9f2c1a7b4e0d6853". Unique so the guard resolves exactly one
          // candidate row and never has to compare against a set of hashes.
          { name: 'key_prefix', type: 'varchar', length: '64', isUnique: true },
          // SHA-256 hex digest of the secret half. Never the secret itself.
          { name: 'key_hash', type: 'varchar', length: '64' },
          { name: 'label', type: 'varchar', length: '120' },
          // Read scopes, stored as a jsonb array of scope strings.
          { name: 'scopes', type: 'jsonb', default: `'[]'::jsonb` },
          // Nullable so a key outlives the admin who created it.
          { name: 'created_by_user_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'last_used_at', type: 'timestamp', isNullable: true },
          { name: 'revoked_at', type: 'timestamp', isNullable: true },
        ],
        indices: [
          { name: 'IDX_API_KEYS_CLUB_ID', columnNames: ['club_id'] },
          { name: 'IDX_API_KEYS_KEY_PREFIX', columnNames: ['key_prefix'] },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'api_keys',
      new TableForeignKey({
        name: 'FK_API_KEYS_CLUB',
        columnNames: ['club_id'],
        referencedTableName: 'clubs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'api_keys',
      new TableForeignKey({
        name: 'FK_API_KEYS_CREATED_BY',
        columnNames: ['created_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['user_id'],
        // The key belongs to the club, not to the person who minted it, so
        // deleting that user must not take the club's integration down.
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('api_keys', true);
  }
}
