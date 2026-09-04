import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BackgroundCheckStatus, BackgroundCheckType } from '@swim-nexus/shared-types';
import { User } from '../../../users/entities/user.entity';

// The shared-types enums are the single source of truth for check types and
// statuses across web and backend. The DBS names are kept as aliases so the
// existing module code and its consumers compile unchanged; the table remains
// dbs_checks and GB rows keep their exact stored values.
export { BackgroundCheckStatus, BackgroundCheckType };
export const DBSCheckType = BackgroundCheckType;
export type DBSCheckType = BackgroundCheckType;
export const DBSStatus = BackgroundCheckStatus;
export type DBSStatus = BackgroundCheckStatus;

@Entity('dbs_checks')
export class DBSCheck {
  @PrimaryGeneratedColumn('uuid')
  dbs_check_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ unique: true })
  certificate_number: string;

  @Column({
    type: 'enum',
    enum: DBSCheckType,
    default: DBSCheckType.ENHANCED,
  })
  check_type: DBSCheckType;

  @Column({
    type: 'enum',
    enum: DBSStatus,
    default: DBSStatus.PENDING,
  })
  status: DBSStatus;

  @Column({ type: 'date' })
  issue_date: Date;

  @Column({ type: 'date', nullable: true })
  expiry_date: Date;

  @Column({ type: 'date', nullable: true })
  last_verified_date: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: true })
  is_valid: boolean;

  @Column({ type: 'uuid', nullable: true })
  uploaded_document_id: string; // Reference to stored document

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string;

  @Column({ type: 'uuid', nullable: true })
  verified_by_user_id: string;
}
