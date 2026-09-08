import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DEFAULT_OFFER_WINDOW_DAYS } from '@club-manager/shared-types';

/**
 * How one club runs its waiting list. One row per club, so club_id is the
 * primary key and a club with no row simply gets the defaults.
 */
@Entity('waiting_list_settings')
export class WaitingListSettings {
  @PrimaryColumn({ type: 'uuid' })
  club_id: string;

  /**
   * On by default. Auto-offer is the product's whole point: manual invite is
   * the fallback, never the default (docs/05, product rule 3).
   */
  @Column({ type: 'boolean', default: true })
  auto_offer_enabled: boolean;

  /** How long a family has to answer an offer before the place falls through. */
  @Column({ type: 'integer', default: DEFAULT_OFFER_WINDOW_DAYS })
  offer_window_days: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
