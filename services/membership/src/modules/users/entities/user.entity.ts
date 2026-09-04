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
  SWIMMER_ADULT = 'swimmer_adult',
  SWIMMER_MINOR = 'swimmer_minor',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash?: string;

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
