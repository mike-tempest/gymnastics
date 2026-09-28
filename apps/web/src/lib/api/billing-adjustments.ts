import { BillingBalance } from '@club-manager/shared-types';

import { api } from './api-client';

export interface AdjustmentHistory {
  invoice_id: string;
  family_id?: string;
  currency: string;
  balance: BillingBalance;
  credits: {
    credit_id: string;
    kind: string;
    amount_minor: string;
    reason: string;
    created_at: string;
    reverses_id?: string;
  }[];
  operations: {
    operation_id?: string;
    kind: string;
    state: string;
    amount_minor: string;
    error?: string;
    created_at: string;
  }[];
  runs?: {
    snapshot: {
      items: {
        item_id: string;
        description: string;
        amount_minor: number;
        discount_minor: number;
        total_minor: number;
        units: number;
        period_units: number;
        discounts: { name: string; amount_minor: number }[];
      }[];
    };
  }[];
}
export interface AdjustmentPreview {
  preview_hash: string;
  amount_minor: number;
  currency: string;
  resulting_due_minor?: number;
  resulting_credit_minor?: number;
  balance: BillingBalance;
}
export const billingApi = {
  history: (id: string) => api.get<AdjustmentHistory>(`/billing-adjustments/invoices/${id}`),
  post: <T>(path: string, input: unknown) => api.post<T>(`/billing-adjustments/${path}`, input),
  get: <T>(path: string) => api.get<T>(`/billing-adjustments/${path}`),
};
