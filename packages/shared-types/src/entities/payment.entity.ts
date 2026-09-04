import { PaymentMethod, PaymentStatus } from '../enums';

export interface Payment {
  payment_id: string;
  invoice_id: string;
  amount: number;
  /** ISO 4217 currency mirrored from the invoice; optional for older API payloads. */
  currency?: string;
  payment_date: Date;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  /** Which provider processed this payment. */
  provider?: string;
  /** Provider-side payment id. Null for a manually recorded payment. */
  provider_payment_id?: string | null;
  reference_number?: string | null;
  /** Normalised provider failure cause (e.g. insufficient_funds). Null unless the payment failed. */
  failure_cause?: string | null;
  /** Provider's human-readable failure sentence. Null unless the payment failed. */
  failure_description?: string | null;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
}
