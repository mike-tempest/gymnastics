import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { AssessmentOutcomeResult } from '@club-manager/shared-types';
import { Member } from '../../members/entities/member.entity';
import { AwardLevel } from './award-level.entity';

export { AssessmentOutcomeResult };

/**
 * One sitting: a coach assessed a group of members against one level on one
 * date. The per-member results hang off it as AssessmentOutcome rows, so the
 * club keeps an audit trail of who assessed whom and when, separate from the
 * current-state MemberAwardProgress row.
 */
@Entity('award_assessment_events')
@Index(['club_id'])
@Index(['level_id'])
export class AssessmentEvent {
  @PrimaryGeneratedColumn('uuid')
  event_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  level_id: string;

  @Column({ type: 'date' })
  assessed_at: Date;

  /** The coach who ran the assessment. Nullable so a CSV import can omit it. */
  @Column({ type: 'uuid', nullable: true })
  assessed_by_user_id: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => AwardLevel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level?: AwardLevel;

  @OneToMany(() => AssessmentOutcome, (outcome) => outcome.event)
  outcomes?: AssessmentOutcome[];
}

/** What one member was judged to have achieved at one assessment event. */
@Entity('award_assessment_outcomes')
@Index(['club_id'])
@Index(['event_id'])
@Index(['member_id'])
export class AssessmentOutcome {
  @PrimaryGeneratedColumn('uuid')
  outcome_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  event_id: string;

  @Column({ type: 'uuid' })
  member_id: string;

  /** Stored as varchar for the same ALTER TYPE reason as AwardScheme.source. */
  @Column({ type: 'varchar', length: 20 })
  outcome: AssessmentOutcomeResult;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** The invoice raised for this member's badge fee, when there was one. */
  @Column({ type: 'uuid', nullable: true })
  invoice_id: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => AssessmentEvent, (event) => event.outcomes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: AssessmentEvent;

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member?: Member;
}
