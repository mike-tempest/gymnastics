import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Member } from '../../members/entities/member.entity';

@Entity('member_cycle_logs')
@Index(['member_id'])
@Index(['period_start'])
export class CycleLog {
  @PrimaryGeneratedColumn('uuid')
  log_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  member_id: string;

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

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member?: Member;
}
