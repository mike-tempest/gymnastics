import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiKeyScope } from '@club-manager/shared-types';

/**
 * A club-scoped credential for the read API (TEM-32).
 *
 * The raw credential is `<key_prefix>.<secret>`. Only the prefix and a
 * SHA-256 digest of the secret are ever persisted, so a database dump does
 * not hand anyone a working key. See the create migration for why a digest
 * rather than a password-style KDF is the right choice for a machine token.
 */
@Entity('api_keys')
@Index(['club_id'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  api_key_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  /** Non-secret lookup and display identifier. Safe to log. */
  @Column({ type: 'varchar', length: 64, unique: true })
  key_prefix: string;

  /**
   * SHA-256 hex digest of the secret half of the credential.
   *
   * Never select this into a response and never log it. Nothing outside
   * ApiKeysService and the guard has any reason to read it.
   */
  @Column({ type: 'varchar', length: 64 })
  key_hash: string;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  scopes: ApiKeyScope[];

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date | null;

  /** Null while the key is live. Set on revocation; the row is never deleted. */
  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date | null;
}
