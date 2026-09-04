import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('safeguarding_officers')
export class SafeguardingOfficer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column()
  name: string;

  @Column()
  role: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  dbs_number: string | null;

  /** Date-only column; hydrates as a YYYY-MM-DD string under the pg driver. */
  @Column({ type: 'date', nullable: true })
  dbs_expiry: Date | string | null;

  @Column({ type: 'text', nullable: true })
  qualifications: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
