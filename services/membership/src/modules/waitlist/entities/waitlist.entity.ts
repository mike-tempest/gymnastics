import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('waitlist')
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable: public marketing-site sign-ups have no tenant yet.
  @Column({ type: 'uuid', nullable: true })
  club_id: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clubName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  role: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 100, default: 'website' })
  source: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmationSentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  drip1SentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  drip2SentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  drip3SentAt: Date | null;
}
