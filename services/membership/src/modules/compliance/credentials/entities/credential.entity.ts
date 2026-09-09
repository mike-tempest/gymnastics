import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CredentialStatus, CredentialType } from '@club-manager/shared-types';
import { Member } from '../../../members/entities/member.entity';
import { User } from '../../../users/entities/user.entity';

// The shared-types enums are the single source of truth for credential types
// and statuses across web and backend, matching how the background-check
// module consumes BackgroundCheckType.
export { CredentialStatus, CredentialType };

/**
 * One credential held by one subject: a first-aid certificate, a coaching
 * qualification, safeguarding training, or anything else the club has to
 * evidence (TEM-30).
 *
 * Exactly one of user_id and member_id is set, enforced by a check constraint
 * in the migration as well as by the DTO. Most credentials belong to staff and
 * coaches, who are users; a gymnast can hold one too, so the subject is a
 * choice rather than being forced onto the user table.
 *
 * credential_type and status are varchar columns backed by TypeScript enums,
 * following the governing_body precedent: a club running its own training
 * scheme should not need a migration, and there is no Postgres enum to keep in
 * step.
 */
@Entity('compliance_credentials')
@Check(
  'CHK_CREDENTIAL_SUBJECT',
  '("user_id" IS NOT NULL AND "member_id" IS NULL) OR ("user_id" IS NULL AND "member_id" IS NOT NULL)',
)
@Index(['club_id'])
@Index(['club_id', 'status'])
@Index(['club_id', 'expiry_date'])
export class Credential {
  @PrimaryGeneratedColumn('uuid')
  credential_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ type: 'uuid', nullable: true })
  member_id: string | null;

  @ManyToOne(() => Member, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'member_id' })
  member?: Member | null;

  @Column({ type: 'varchar', length: 40 })
  credential_type: CredentialType;

  /** What the credential actually is, e.g. "Emergency First Aid at Work". */
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  issuing_body: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference_number: string | null;

  /** Date-only column; hydrates as a YYYY-MM-DD string under the pg driver. */
  @Column({ type: 'date' })
  issue_date: Date | string;

  /** Null for a credential that does not expire. */
  @Column({ type: 'date', nullable: true })
  expiry_date: Date | string | null;

  @Column({ type: 'varchar', length: 20, default: CredentialStatus.VALID })
  status: CredentialStatus;

  /** Where the certificate is filed: a URL or the club's own reference. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  document_reference: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;
}
