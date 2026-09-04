import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Family } from '../../../families/entities/family.entity';

export enum DirectDebitMandateStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

@Entity('direct_debit_mandates')
export class DirectDebitMandate {
  @PrimaryGeneratedColumn('uuid')
  mandate_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  family_id: string;

  /** Payment provider this mandate is held with. */
  @Column({ type: 'varchar', length: 50, default: 'gocardless' })
  provider: string;

  /**
   * Provider-side mandate identifier.
   *
   * Unique together with `provider`, not on its own: two providers could
   * legitimately mint the same id string. The uniqueness is deliberately
   * GLOBAL rather than per-club, so one provider mandate can never be attached
   * to two clubs.
   */
  @Column({ type: 'varchar', length: 255 })
  provider_mandate_id: string;

  /** Provider-side customer identifier, where the provider exposes one. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_customer_id: string | null;

  @Column({
    type: 'enum',
    enum: DirectDebitMandateStatus,
    default: DirectDebitMandateStatus.PENDING,
  })
  status: DirectDebitMandateStatus;

  @Column({ type: 'varchar', length: 50, default: 'bacs' })
  scheme: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Family, { nullable: false })
  @JoinColumn({ name: 'family_id' })
  family?: Family;
}
