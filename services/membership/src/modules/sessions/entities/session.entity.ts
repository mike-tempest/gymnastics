import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Squad } from '../../squads/entities/squad.entity';

export enum SessionStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  session_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid', nullable: true })
  squad_id: string | null;

  @Column({ type: 'varchar', length: 200 })
  session_name: string;

  @Column({ type: 'date' })
  session_date: Date;

  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  coach_name: string | null;

  @Column({ type: 'int', nullable: true })
  max_participants: number | null;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.SCHEDULED,
  })
  status: SessionStatus;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Squad, { nullable: true })
  @JoinColumn({ name: 'squad_id' })
  squad?: Squad;
}
