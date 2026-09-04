import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { LocationDto } from './dto/update-club-settings.dto';

// club_settings is one row per club; the UNIQUE(club_id) constraint was added
// in the Phase 1 multi-tenancy migration. Reflected here so the model matches.
@Entity('club_settings')
@Unique(['club_id'])
export class ClubSettings {
  @PrimaryGeneratedColumn('uuid')
  settings_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 255, default: 'Swim Club' })
  club_name: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  website: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  logo_url: string;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  swim_england: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true, default: '[]' })
  locations: LocationDto[];

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  billing_config: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  notification_prefs: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
