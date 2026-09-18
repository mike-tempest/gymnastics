import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TREASURER = 'treasurer',
  HEAD_COACH = 'head_coach',
  SQUAD_COACH = 'squad_coach',
  WELFARE_OFFICER = 'welfare_officer',
  COMPETITION_SECRETARY = 'competition_secretary',
  PARENT = 'parent',
  MEMBER_ADULT = 'member_adult',
  MEMBER_MINOR = 'member_minor',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password_hash?: string;

  @Column({ default: 0 })
  session_version: number;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  password_reset_hash: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  password_reset_expires_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  password_reset_requested_at: Date | null;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PARENT,
  })
  role: UserRole;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  family_id: string;

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
