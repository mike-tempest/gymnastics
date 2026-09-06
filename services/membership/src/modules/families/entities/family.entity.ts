import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Member } from '../../members/entities/member.entity';

@Entity('families')
export class Family {
  @PrimaryGeneratedColumn('uuid')
  family_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 200 })
  family_name: string;

  @Column({ type: 'varchar', length: 100 })
  primary_contact_name: string;

  @Column({ type: 'varchar', length: 255 })
  primary_contact_email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  primary_contact_phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line1: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line2: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postcode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  invite_token: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  invite_status: string | null;

  @Column({ type: 'timestamp', nullable: true })
  invited_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  invite_accepted_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => Member, (member) => member.family)
  members?: Member[];
}
