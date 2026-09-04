import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Swimmer } from '../../swimmers/entities/swimmer.entity';

@Entity('swimmer_cycle_logs')
@Index(['swimmer_id'])
@Index(['period_start'])
export class CycleLog {
  @PrimaryGeneratedColumn('uuid')
  log_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  swimmer_id: string;

  @Column({ type: 'date' })
  period_start: Date;

  @Column({ type: 'date', nullable: true })
  period_end: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  symptoms: string[] | null; // e.g. ['cramps', 'fatigue', 'headache']

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => Swimmer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'swimmer_id' })
  swimmer?: Swimmer;
}
