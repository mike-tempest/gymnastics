import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Competition, CourseType } from './competition.entity';

/** One leg of a relay: who swam it and (optionally) their split. */
export interface RelayLeg {
  leg: number;
  swimmer_id: string | null;
  name: string | null;
  split: number | null;
}

@Entity('competition_results')
export class CompetitionResult {
  @PrimaryGeneratedColumn('uuid')
  result_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  competition_id: string;

  @Column({ type: 'uuid' })
  swimmer_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  event_name: string | null;

  @Column({ type: 'int' })
  distance: number;

  @Column({ type: 'varchar', length: 50 })
  stroke: string;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  time: number;

  @Column({ type: 'int', nullable: true })
  place: number | null;

  @Column({ type: 'int', nullable: true })
  heat: number | null;

  @Column({ type: 'int', nullable: true })
  lane: number | null;

  @Column({ type: 'boolean', default: false })
  dq: boolean;

  @Column({ type: 'text', nullable: true })
  dq_reason: string | null;

  @Column({ type: 'boolean', default: false })
  is_pb: boolean;

  @Column({ type: 'jsonb', nullable: true })
  splits: number[] | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  course: CourseType | null;

  /** Date the time was swum, when it differs from the meet's start date. */
  @Column({ type: 'date', nullable: true })
  swum_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_relay: boolean;

  @Column({ type: 'jsonb', nullable: true })
  relay_legs: RelayLeg[] | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => Competition, (competition) => competition.results)
  @JoinColumn({ name: 'competition_id' })
  competition?: Competition;
}
