import { api } from './api-client';

export * from './finance';

// ==================== Direct Debit Collection ====================

export interface CollectInvoicePaymentResponse {
  success: boolean;
  payment: unknown;
  message: string;
}

export interface CollectPendingPaymentsResponse {
  success: boolean;
  stats: {
    attempted: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  message: string;
}

export async function collectInvoicePayment(
  invoiceId: string
): Promise<CollectInvoicePaymentResponse> {
  return api.post<CollectInvoicePaymentResponse>(`/payments/collect-invoice/${invoiceId}`);
}

export async function collectPendingPayments(): Promise<CollectPendingPaymentsResponse> {
  return api.post<CollectPendingPaymentsResponse>('/payments/collect-pending');
}
