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
import { Member } from '../../members/entities/member.entity';
import { Session } from '../../sessions/entities/session.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

@Entity('attendance')
@Unique(['session_id', 'member_id'])
@Index(['session_id'])
@Index(['member_id'])
@Index(['status'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  attendance_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  session_id: string;

  @Column({ type: 'uuid' })
  member_id: string;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  @Column({ type: 'timestamp', nullable: true })
  checked_in_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Member, { eager: false })
  @JoinColumn({ name: 'member_id' })
  member?: Member;

  @ManyToOne(() => Session, { eager: false })
  @JoinColumn({ name: 'session_id' })
  session?: Session;
}
