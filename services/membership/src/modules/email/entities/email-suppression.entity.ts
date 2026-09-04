import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * An email address that opted out of marketing and nurture email (waitlist
 * drips, activation sequence). Transactional email (invoices, payment status,
 * session reminders) ignores this table: those messages are part of the
 * service itself.
 */
@Entity('email_suppressions')
export class EmailSuppression {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50, default: 'unsubscribed' })
  reason: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
