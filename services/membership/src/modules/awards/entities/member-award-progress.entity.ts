import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { AwardProgressStatus } from '@club-manager/shared-types';
import { Member } from '../../members/entities/member.entity';
import { AwardLevel } from './award-level.entity';

export { AwardProgressStatus };

/**
 * Where one member has got to on one level. There is at most one row per
 * (member, level) pair: a member works towards a badge, is assessed for it,
 * then is awarded it, and the row moves through those states.
 */
@Entity('member_award_progress')
@Unique('UQ_MEMBER_AWARD_PROGRESS_MEMBER_LEVEL', ['member_id', 'level_id'])
@Index(['club_id'])
@Index(['member_id'])
@Index(['level_id'])
export class MemberAwardProgress {
  @PrimaryGeneratedColumn('uuid')
  progress_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  member_id: string;

  @Column({ type: 'uuid' })
  level_id: string;

  /** Stored as varchar for the same ALTER TYPE reason as AwardScheme.source. */
  @Column({ type: 'varchar', length: 20, default: AwardProgressStatus.WORKING_TOWARDS })
  status: AwardProgressStatus;

  @Column({ type: 'date', nullable: true })
  started_on: Date | null;

  @Column({ type: 'date', nullable: true })
  assessed_on: Date | null;

  @Column({ type: 'date', nullable: true })
  awarded_on: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** The invoice raised for the badge fee, when there was one to raise. */
  @Column({ type: 'uuid', nullable: true })
  invoice_id: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member?: Member;

  @ManyToOne(() => AwardLevel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level?: AwardLevel;
}
