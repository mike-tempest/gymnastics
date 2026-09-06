import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Member } from '../../members/entities/member.entity';

export enum ReadinessLevel {
  GREEN = 'green',
  AMBER = 'amber',
  RED = 'red',
}

@Entity('member_wellbeing_logs')
@Unique(['member_id', 'log_date'])
@Index(['member_id'])
@Index(['log_date'])
export class WellbeingLog {
  @PrimaryGeneratedColumn('uuid')
  log_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  member_id: string;

  @Column({ type: 'date' })
  log_date: Date;

  @Column({ type: 'smallint' })
  energy_level: number; // 1-5

  @Column({ type: 'smallint', nullable: true })
  sleep_quality: number | null; // 1-5

  @Column({ type: 'smallint' })
  comfort_in_water: number; // 1-5

  @Column({ type: 'text', nullable: true })
  notes: string | null; // Private, only visible to parent/member

  @Column({ type: 'boolean', default: false })
  prefers_land_training: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member?: Member;

  /**
   * Derives a readiness indicator from energy and comfort levels.
   * This is the only data coaches can see -- never the raw values.
   */
  get readiness(): ReadinessLevel {
    if (this.prefers_land_training) return ReadinessLevel.RED;
    const avg = (this.energy_level + this.comfort_in_water) / 2;
    if (avg >= 3.5) return ReadinessLevel.GREEN;
    if (avg >= 2) return ReadinessLevel.AMBER;
    return ReadinessLevel.RED;
  }
}
