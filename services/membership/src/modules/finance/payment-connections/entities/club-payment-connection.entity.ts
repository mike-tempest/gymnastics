import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Lifecycle of a club's connection to its own payment provider account.
 *
 * `pending` covers an onboarding that has started but is not usable yet: the
 * provider account exists, but the club has outstanding requirements (identity
 * checks, a bank account) so it cannot take money. `restricted` is a previously
 * working connection the provider has since limited.
 */
export enum PaymentConnectionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  RESTRICTED = 'restricted',
  DISCONNECTED = 'disconnected',
}

/**
 * Provider capabilities as last reported by the provider itself.
 *
 * Mirrored from the provider rather than inferred, because "the club finished
 * onboarding" and "the club can actually be charged" are different facts and
 * only the provider knows the second one.
 */
export interface PaymentConnectionCapabilities {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements_due?: string[];
}

/**
 * A club's connection to ITS OWN payment provider account.
 *
 * Swimly is not the merchant of record: funds move between the payer and the
 * club's own account, and Swimly only orchestrates. This row is what makes that
 * possible, and it is the single source of truth for which provider a club
 * transacts on. There is deliberately no "which provider did this club pick"
 * setting anywhere else; picking a provider IS connecting an account.
 *
 * No club's API keys are stored here. Stripe Connect authenticates with the
 * platform key plus `external_account_id`, so there is no per-club secret at
 * all. GoCardless Partner OAuth does issue a per-merchant bearer token, which
 * is why the encrypted-token columns exist, unused, ready for that phase.
 */
@Entity('club_payment_connections')
export class ClubPaymentConnection {
  @PrimaryGeneratedColumn('uuid')
  connection_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  /** 'stripe' | 'gocardless'. Kept as varchar to match the sibling tables. */
  @Column({ type: 'varchar', length: 50 })
  provider: string;

  /**
   * The provider-side account id: a Stripe `acct_…` or a GoCardless
   * organisation id. Not a secret. Unique per provider, which is both how an
   * inbound webhook is routed back to a club and what stops two clubs claiming
   * the same provider account.
   */
  @Column({ type: 'varchar', length: 255 })
  external_account_id: string;

  @Column({
    type: 'enum',
    enum: PaymentConnectionStatus,
    default: PaymentConnectionStatus.PENDING,
  })
  status: PaymentConnectionStatus;

  @Column({ type: 'jsonb', default: '{}' })
  capabilities: PaymentConnectionCapabilities;

  /**
   * Whether this connection moves real money.
   *
   * Carried explicitly because a test-mode account attached to a live club is
   * the worst kind of failure: every charge "succeeds" and no money moves.
   */
  @Column({ type: 'boolean', default: false })
  livemode: boolean;

  /**
   * Encrypted per-merchant bearer token, for providers that need one
   * (GoCardless Partner OAuth). Null for Stripe, which needs no per-club
   * secret. Nothing writes this yet; the columns exist so the GoCardless phase
   * does not need another migration on a table by then holding live rows.
   */
  @Column({ type: 'text', nullable: true })
  access_token_encrypted: string | null;

  /** Identifies which key encrypted access_token_encrypted, so keys can rotate. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  encryption_key_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  connected_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disconnected_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
