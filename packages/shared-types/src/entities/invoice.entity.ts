import { InvoiceStatus } from '../enums';

export interface Invoice {
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
