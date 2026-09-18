import { InvoiceStatus } from '../enums';

/** Amounts are integer minor units, including reservations that are not settled cash. */
export interface BillingBalance {
  original_minor: number;
  credit_notes_minor: number;
  allocated_in_minor: number;
  allocated_out_minor: number;
  paid_minor: number;
  refunded_minor: number;
  reserved_refunds_minor: number;
  pending_minor: number;
  due_minor: number;
  collectable_minor: number;
  available_credit_minor: number;
}

export interface Invoice {
  billing_tax_inclusive?: boolean;
  billing_balance?: BillingBalance;
  invoice_id: string;
  family_id: string;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  /** ISO 4217 currency stamped from the club at creation; optional for older API payloads. */
  currency?: string;
  due_date: Date;
  issued_date: Date;
  status: InvoiceStatus;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceItem {
  item_id: string;
  invoice_id: string;
  description: string;
  unit_price: number;
  quantity: number;
  total: number;
  fee_structure_id?: string | null;
  created_at: Date;
  updated_at: Date;
}
