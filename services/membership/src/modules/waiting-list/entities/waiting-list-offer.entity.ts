import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { WaitingListOfferStatus } from '@club-manager/shared-types';
import { Squad } from '../../squads/entities/squad.entity';
import { WaitingListEntry } from './waiting-list-entry.entity';

export { WaitingListOfferStatus };

/**
 * One offer of a specific squad place to one waiting list entry.
 *
 * A pending offer reserves the place: the free-capacity calculation subtracts
 * pending offers as well as members, so the same place is never offered twice.
 * When the offer lapses or is declined the reservation disappears with it and
 * the place falls through to the next entry immediately.
 */
@Entity('waiting_list_offers')
@Unique('UQ_WAITING_LIST_OFFERS_ACCEPT_TOKEN', ['accept_token'])
@Index(['club_id'])
@Index(['squad_id', 'status'])
@Index(['status', 'expires_at'])
export class WaitingListOffer {
  @PrimaryGeneratedColumn('uuid')
  offer_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  entry_id: string;

  @Column({ type: 'uuid' })
  squad_id: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  offered_at: Date;

  /** End of the acceptance window, from the club's offer_window_days setting. */
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  /**
   * Stored as varchar rather than a Postgres enum, for the same reason as the
   * entry status. WaitingListOfferStatus is enforced at the DTO layer.
   */
  @Column({ type: 'varchar', length: 20, default: WaitingListOfferStatus.PENDING })
  status: WaitingListOfferStatus;

  @Column({ type: 'text', nullable: true })
  decline_reason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  responded_at: Date | null;

  /**
   * Random single-use token behind the accept and decline links in the offer
   * email. Unique across every club, so the token alone identifies the offer
   * and the parent needs no account to answer.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  accept_token: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => WaitingListEntry, (entry) => entry.offers)
  @JoinColumn({ name: 'entry_id' })
  entry?: WaitingListEntry;

  @ManyToOne(() => Squad)
  @JoinColumn({ name: 'squad_id' })
  squad?: Squad;
}
