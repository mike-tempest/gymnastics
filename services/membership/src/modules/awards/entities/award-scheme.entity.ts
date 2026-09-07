import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Unique,
} from 'typeorm';
import { AwardSchemeSource } from '@club-manager/shared-types';
import { AwardLevel } from './award-level.entity';

export { AwardSchemeSource };

/**
 * A badge or award scheme a club runs: British Gymnastics Rise, the legacy
 * Proficiency Awards, or the club's own. Schemes are rows, never enum values,
 * because Rise is a live transition and plenty of clubs run their own badges
 * alongside it.
 */
@Entity('award_schemes')
@Unique('UQ_AWARD_SCHEMES_CLUB_NAME', ['club_id', 'name'])
@Index(['club_id'])
export class AwardScheme {
  @PrimaryGeneratedColumn('uuid')
  scheme_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Stored as varchar rather than a Postgres enum so a new source can be added
   * without an ALTER TYPE, which cannot run inside the transaction TypeORM
   * wraps migrations in. AwardSchemeSource is enforced at the DTO layer.
   */
  @Column({ type: 'varchar', length: 40, default: AwardSchemeSource.CUSTOM })
  source: AwardSchemeSource;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => AwardLevel, (level) => level.scheme)
  levels?: AwardLevel[];
}
