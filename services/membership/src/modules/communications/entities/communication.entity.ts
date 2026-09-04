import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Squad } from '../../squads/entities/squad.entity';
import { Family } from '../../families/entities/family.entity';

export enum RecipientType {
  ALL = 'all',
  SQUAD = 'squad',
  FAMILY = 'family',
}

@Entity('communications')
export class Communication {
  @PrimaryGeneratedColumn('uuid')
  communication_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'enum',
    enum: RecipientType,
  })
  recipient_type: RecipientType;

  @Column({ type: 'uuid', nullable: true })
  squad_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  family_id: string | null;

  @Column({ type: 'integer', default: 0 })
  recipient_count: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  sent_date: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Squad, { nullable: true })
  @JoinColumn({ name: 'squad_id' })
  squad?: Squad;

  @ManyToOne(() => Family, { nullable: true })
  @JoinColumn({ name: 'family_id' })
  family?: Family;
}
