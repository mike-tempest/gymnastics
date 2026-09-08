import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Discipline, SquadType, WaitingListStatus } from '@club-manager/shared-types';
import { Squad } from '../../squads/entities/squad.entity';
import { WaitingListOffer } from './waiting-list-offer.entity';

export { WaitingListStatus };

/**
 * One child waiting for a place at this club.
 *
 * Joining takes no account, so the parent's name, email and phone live on the
 * entry rather than on a family record. The family, the member and everything
 * else are created in one action when the place is taken; see
 * EnrolmentService.
 *
 * Position on the list is never stored. It falls out of the priority columns
 * and joined_at (see WAITING_LIST_PRIORITY_ORDER), so a boost, a withdrawal
 * or an enrolment reorders the list without rewriting any rows.
 */
@Entity('waiting_list_entries')
@Index(['club_id'])
@Index(['club_id', 'status', 'joined_at'])
export class WaitingListEntry {
  @PrimaryGeneratedColumn('uuid')
  entry_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'varchar', length: 100 })
  child_first_name: string;

  @Column({ type: 'varchar', length: 100 })
  child_last_name: string;

  @Column({ type: 'date' })
  child_dob: Date;

  @Column({ type: 'varchar', length: 10, nullable: true })
  child_gender: string | null;

  @Column({ type: 'varchar', length: 200 })
  parent_name: string;

  @Column({ type: 'varchar', length: 255 })
  parent_email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  parent_phone: string | null;

  /**
   * What the family asked for. Each of these narrows which squads the entry is
   * eligible for; leaving them null means "anything with a free place".
   */
  @Column({ type: 'varchar', length: 40, nullable: true })
  desired_discipline: Discipline | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  desired_squad_type: SquadType | null;

  @Column({ type: 'uuid', nullable: true })
  preferred_squad_id: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  joined_at: Date;

  /** The family already has a child at the club. */
  @Column({ type: 'boolean', default: false })
  is_existing_member_family: boolean;

  /** This child is a sibling of a current member. */
  @Column({ type: 'boolean', default: false })
  is_sibling: boolean;

  /** Admin override. Higher wins, and it beats every other priority flag. */
  @Column({ type: 'integer', default: 0 })
  priority_boost: number;

  /**
   * Stored as varchar rather than a Postgres enum so a new status can be added
   * without an ALTER TYPE, which cannot run inside the transaction TypeORM
   * wraps migrations in. WaitingListStatus is enforced at the DTO layer.
   */
  @Column({ type: 'varchar', length: 20, default: WaitingListStatus.WAITING })
  status: WaitingListStatus;

  @Column({ type: 'uuid', nullable: true })
  enrolled_member_id: string | null;

  @Column({ type: 'text', nullable: true })
  withdrawn_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Squad, { nullable: true })
  @JoinColumn({ name: 'preferred_squad_id' })
  preferred_squad?: Squad | null;

  @OneToMany(() => WaitingListOffer, (offer) => offer.entry)
  offers?: WaitingListOffer[];
}
