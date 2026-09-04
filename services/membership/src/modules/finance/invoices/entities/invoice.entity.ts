import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Family } from '../../../families/entities/family.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from '../../payments/entities/payment.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  invoice_id: string;

  @Column({ type: 'uuid' })
  club_id: string;

  @Column({ type: 'uuid' })
  family_id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  invoice_number: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_amount: number;

  /**
   * ISO 4217 currency the amounts on this invoice are denominated in. Stamped
   * from the owning club on creation. Defaults to GBP for existing rows.
   */
  @Column({ type: 'varchar', length: 3, default: 'GBP' })
  currency: string;

  @Column({ type: 'date' })
  due_date: Date;

  @Column({ type: 'date' })
  issued_date: Date;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /**
   * The fee structure this invoice was generated from, when it was produced by
   * the invoice-generation engine. NULL for manually created invoices.
   * Together with billing_period this makes generation idempotent: a family is
   * only ever invoiced once per fee structure and billing period.
   */
  @Column({ type: 'uuid', nullable: true })
  fee_structure_id: string | null;

  /**
   * The billing period this generated invoice covers, e.g. '2026-07' for a
   * monthly fee, '2026' for an annual fee, or a caller-supplied label such as
   * 'Term 1 2027' for a term fee. NULL for manually created invoices.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  billing_period: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Family, { nullable: false })
  @JoinColumn({ name: 'family_id' })
  family?: Family;

  @OneToMany(() => InvoiceItem, (item) => item.invoice)
  items?: InvoiceItem[];

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments?: Payment[];
}
