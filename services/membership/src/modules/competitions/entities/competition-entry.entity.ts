import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Competition } from './competition.entity';

export enum EntryStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  WITHDRAWN = 'withdrawn',
}

@Entity('competition_entries')
export class CompetitionEntry {
  @PrimaryGeneratedColumn('uuid')
  entry_id: string;

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

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  entry_time: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  seed_time: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  age_group: string | null;

  @Column({ type: 'varchar', length: 50, default: EntryStatus.PENDING })
  status: EntryStatus;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => Competition, (competition) => competition.entries)
  @JoinColumn({ name: 'competition_id' })
  competition?: Competition;
}
