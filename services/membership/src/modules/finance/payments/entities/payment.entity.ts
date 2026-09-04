import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';

export enum PaymentMethod {
  DIRECT_DEBIT = 'direct_debit',
  CARD = 'card',
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  OTHER = 'other',
}

export enum PaymentStatus {
  PENDING_SUBMISSION = 'pending_submission',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  payment_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  /**
   * ISO 4217 currency this payment is collected in. Mirrors the parent invoice's
   * currency on creation. Defaults to GBP for existing rows.
   */
  @Column({ type: 'varchar', length: 3, default: 'GBP' })
  currency: string;

  @Column({ type: 'date' })
  payment_date: Date;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.DIRECT_DEBIT,
  })
  payment_method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING_SUBMISSION,
  })
  status: PaymentStatus;

  /** Payment provider that processed this payment. */
  @Column({ type: 'varchar', length: 50, default: 'gocardless' })
  provider: string;

  /**
   * Provider-side payment identifier, unique together with `provider`.
   *
   * Nullable because a manually recorded payment (cash, bank transfer) has no
   * provider payment at all.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_payment_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference_number: string | null;

  /**
   * Normalised, machine-readable failure cause from the provider webhook
   * (GoCardless event.details.cause, e.g. insufficient_funds, refer_to_payer,
   * bank_account_closed). Scheme-neutral across Bacs and BECS; payer-facing
   * copy is keyed on this value. NULL until the payment fails.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  failure_cause: string | null;

  /**
   * Provider's human-readable sentence for the failure (GoCardless
   * event.details.description), truncated to 255 characters. Used as a
   * fallback when no bespoke copy exists for the cause, and for admin
   * display. NULL until the payment fails.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  failure_description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;
}
