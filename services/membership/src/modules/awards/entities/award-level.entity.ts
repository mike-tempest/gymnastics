import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AwardScheme } from './award-scheme.entity';

/**
 * One badge within a scheme, for example "Explore 3". The order a club works
 * through its levels is club data too, hence sort_order rather than an implied
 * ordering by name.
 */
@Entity('award_levels')
@Index(['club_id'])
@Index(['scheme_id'])
export class AwardLevel {
  @PrimaryGeneratedColumn('uuid')
  level_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  scheme_id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', default: 0 })
  sort_order: number;

  /**
   * Charged to the family when the badge is awarded. Null means no charge.
   *
   * Like every other decimal in this service (see FeeStructure.amount), the
   * Postgres driver hands this back as a string at runtime, so callers coerce
   * with Number() before doing arithmetic on it.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  badge_fee: number | null;

  /** Charged alongside the badge when set. Null means no charge. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  certificate_fee: number | null;

  /**
   * Optional link to a one-time fee structure so badge income lands in the
   * club's existing finance reporting. Purely a reference: the amount charged
   * is always badge_fee / certificate_fee above.
   */
  @Column({ type: 'uuid', nullable: true })
  fee_structure_id: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => AwardScheme, (scheme) => scheme.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheme_id' })
  scheme?: AwardScheme;
}
