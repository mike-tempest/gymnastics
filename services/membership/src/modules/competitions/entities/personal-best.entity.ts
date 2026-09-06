import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { CourseType } from './competition.entity';
import { CompetitionResult } from './competition-result.entity';

/**
 * The fastest non-DQ individual time a member has recorded for one event
 * (distance + stroke) in one course type. Maintained by
 * PersonalBestsService.recomputeForMember whenever results change; never
 * written directly by request handlers.
 */
@Entity('personal_bests')
@Unique(['member_id', 'distance', 'stroke', 'course'])
export class PersonalBest {
  @PrimaryGeneratedColumn('uuid')
  pb_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  member_id: string;

  @Column({ type: 'int' })
  distance: number;

  @Column({ type: 'varchar', length: 50 })
  stroke: string;

  @Column({ type: 'varchar', length: 10 })
  course: CourseType;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  time: number;

  @Column({ type: 'uuid', nullable: true })
  result_id: string | null;

  @Column({ type: 'date', nullable: true })
  achieved_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => CompetitionResult, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'result_id' })
  result?: CompetitionResult | null;
}
