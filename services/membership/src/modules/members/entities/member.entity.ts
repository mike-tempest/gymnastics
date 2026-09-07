import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Discipline, GoverningBody } from '@club-manager/shared-types';
import { Family } from '../../families/entities/family.entity';
import { Squad } from '../../squads/entities/squad.entity';

@Entity('members')
// A registration number is unique within a governing body, not globally: the
// same digits can be issued by two different home nations.
@Unique('UQ_MEMBERS_BODY_REGISTRATION_NUMBER', ['governing_body', 'registration_number'])
export class Member {
  @PrimaryGeneratedColumn('uuid')
  member_id: string;

  @Column({ type: 'uuid', nullable: true })
  family_id: string | null;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  registration_number: string | null;

  // Which UK home-nation governing body issued the registration_number above.
  @Column({ type: 'varchar', length: 40, nullable: true })
  governing_body: GoverningBody | null;

  @Column({ type: 'varchar', length: 100 })
  first_name: string;

  @Column({ type: 'varchar', length: 100 })
  last_name: string;

  @Column({ type: 'date' })
  dob: Date;

  @Column({ type: 'varchar', length: 10 })
  gender: string;

  @Column({ type: 'uuid', nullable: true })
  squad_id: string | null;

  // Primary discipline this gymnast trains in. Filtering and reporting only.
  @Column({ type: 'varchar', length: 40, nullable: true })
  discipline: Discipline | null;

  @Column({ type: 'text', nullable: true })
  medical_notes: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  emergency_contact: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photo_url: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Family, (family) => family.members)
  @JoinColumn({ name: 'family_id' })
  family?: Family;

  @ManyToOne(() => Squad, { nullable: true })
  @JoinColumn({ name: 'squad_id' })
  squad?: Squad | null;
}
