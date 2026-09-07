import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Member } from '../../../members/entities/member.entity';
import { User } from '../../../users/entities/user.entity';

export enum ConsentType {
  PHOTOGRAPHY = 'PHOTOGRAPHY', // Photos for promotional use
  VIDEO = 'VIDEO', // Video for coaching/promotional use
  MEDICAL_TREATMENT = 'MEDICAL_TREATMENT', // Emergency medical treatment
  DATA_SHARING = 'DATA_SHARING', // Share data with the club's governing body
  TRANSPORT = 'TRANSPORT', // Travel in coach/volunteer vehicles
  SOCIAL_MEDIA = 'SOCIAL_MEDIA', // Photos/videos on social media
  NEWSLETTER = 'NEWSLETTER', // Email newsletters
  CONTACT = 'CONTACT', // Contact via email/SMS
  WELLBEING_CYCLE_TRACKING = 'WELLBEING_CYCLE_TRACKING', // Track menstrual cycle for wellbeing
}

export enum ConsentStatus {
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  PENDING = 'PENDING',
  REVOKED = 'REVOKED', // Previously granted, now revoked
  EXPIRED = 'EXPIRED', // Time-limited consent that expired
}

@Entity('consents')
export class Consent {
  @PrimaryGeneratedColumn('uuid')
  consent_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  member_id: string;

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({
    type: 'enum',
    enum: ConsentType,
  })
  consent_type: ConsentType;

  @Column({
    type: 'enum',
    enum: ConsentStatus,
    default: ConsentStatus.PENDING,
  })
  status: ConsentStatus;

  @Column({ type: 'uuid' })
  granted_by_user_id: string; // Parent/Guardian who gave consent

  @ManyToOne(() => User)
  @JoinColumn({ name: 'granted_by_user_id' })
  granted_by: User;

  @Column({ type: 'date' })
  granted_date: Date;

  @Column({ type: 'date', nullable: true })
  revoked_date: Date;

  @Column({ type: 'uuid', nullable: true })
  revoked_by_user_id: string;

  @Column({ type: 'date', nullable: true })
  expiry_date: Date; // Some consents may have expiry dates

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  specific_conditions: string; // E.g., "Photos ok but not on social media"

  @Column({ default: false })
  requires_annual_renewal: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
