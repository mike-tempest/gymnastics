import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CompetitionEntry } from './competition-entry.entity';
import { CompetitionResult } from './competition-result.entity';

export enum CompetitionType {
  OPEN_MEET = 'open_meet',
  COUNTY = 'county',
  REGIONAL = 'regional',
  NATIONAL = 'national',
  CLUB_GALA = 'club_gala',
  TIME_TRIAL = 'time_trial',
}

/** A consideration/qualifying standard for one event at a meet. */
export interface QualifyingTime {
  distance: number;
  stroke: string;
  /** Slowest time (in seconds) that qualifies for the event. */
  time: number;
}

export enum CompetitionStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
  RESULTS_PUBLISHED = 'results_published',
}

export enum CourseType {
  SC = 'SC', // Short course (25m)
  LC = 'LC', // Long course (50m)
}

@Entity('competitions')
export class Competition {
  @PrimaryGeneratedColumn('uuid')
  competition_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  organiser: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  venue: string | null;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date | null;

  @Column({ type: 'varchar', length: 50, default: CompetitionType.OPEN_MEET })
  type: CompetitionType;

  @Column({ type: 'varchar', length: 10, default: CourseType.SC })
  course: CourseType;

  @Column({ type: 'varchar', length: 50, default: CompetitionStatus.DRAFT })
  status: CompetitionStatus;

  @Column({ type: 'timestamp', nullable: true })
  entry_deadline: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  qualifying_times: QualifyingTime[] | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => CompetitionEntry, (entry) => entry.competition)
  entries?: CompetitionEntry[];

  @OneToMany(() => CompetitionResult, (result) => result.competition)
  results?: CompetitionResult[];
}
