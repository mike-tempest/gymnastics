import { Invoice, InvoiceItem, Payment, InvoiceStatus, PaymentMethod } from '@swim-nexus/shared-types';

import { api, apiDownload } from './api-client';

// ==================== Input Types ====================

export interface CreateInvoiceInput {
  family_id: string;
  due_date: string;
  items: {
    description: string;
    amount: number;
    type: 'squad_fee' | 'membership' | 'gala_entry' | 'merchandise' | 'other';
    swimmer_id?: string | null;
  }[];
  notes?: string;
}

export interface UpdateInvoiceInput {
  due_date?: string;
  status?: InvoiceStatus;
  items?: {
    description: string;
    amount: number;
    type: 'squad_fee' | 'membership' | 'gala_entry' | 'merchandise' | 'other';
    swimmer_id?: string | null;
  }[];
  notes?: string;
}

export interface CreatePaymentInput {
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export type FeeFrequencyValue = 'monthly' | 'term' | 'annual' | 'one_time';

export interface CreateFeeStructureInput {
  name: string;
  description?: string;
  amount: number;
  frequency: FeeFrequencyValue;
  applies_to: 'club' | 'squad' | 'swimmer';
  squad_id?: string | null;
  is_active: boolean;
}

export interface UpdateFeeStructureInput {
  name?: string;
  description?: string;
  amount?: number;
  frequency?: FeeFrequencyValue;
  applies_to?: 'club' | 'squad' | 'swimmer';
  squad_id?: string | null;
  is_active?: boolean;
}

export interface FeeStructure {
  fee_structure_id: string;
  club_id: string;
  name: string;
  description: string | null;
  amount: number;
  /** ISO 4217 currency stamped from the club; optional for older API payloads. */
  currency?: string;
  frequency: FeeFrequencyValue;
  applies_to: 'club' | 'squad' | 'swimmer';
  squad_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithDetails extends Invoice {
  family?: {
    family_id: string;
    family_name: string;
    primary_contact_name: string;
    primary_contact_email: string;
  };
  items?: InvoiceItem[];
  payments?: Payment[];
  // Tax label stamped from the club (for example "VAT", "Sales tax", "GST").
  // Optional for older API payloads; falls back to "Tax" when absent.
  tax_label?: string | null;
}

export interface FinanceDashboard {
  total_outstanding: number;
  overdue_count: number;
  this_month_revenue: number;
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  recent_payments: Payment[];
}

export interface InvoiceFilters {
  family_id?: string;
  status?: InvoiceStatus;
  date_from?: string;
  date_to?: string;
}

// ==================== Invoice API Functions ====================

export async function getInvoices(filters?: InvoiceFilters): Promise<InvoiceWithDetails[]> {
  const params = new URLSearchParams();
  if (filters?.family_id) params.append('family_id', filters.family_id);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.date_from) params.append('date_from', filters.date_from);
  if (filters?.date_to) params.append('date_to', filters.date_to);

  const queryString = params.toString();
  const path = `/invoices${queryString ? `?${queryString}` : ''}`;

  return api.get<InvoiceWithDetails[]>(path, { cache: 'no-store' });
}

export async function getInvoice(id: string): Promise<InvoiceWithDetails> {
  return api.get<InvoiceWithDetails>(`/invoices/${id}`, { cache: 'no-store' });
}

export async function createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
  return api.post<Invoice>('/invoices', data);
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput): Promise<Invoice> {
  return api.patch<Invoice>(`/invoices/${id}`, data);
}

export async function deleteInvoice(id: string): Promise<void> {
  return api.delete<void>(`/invoices/${id}`);
}

export async function generateMonthlyInvoices(squadId?: string): Promise<{ created_count: number }> {
  const path = squadId ? `/invoices/generate-monthly?squad_id=${encodeURIComponent(squadId)}` : '/invoices/generate-monthly';
  return api.post<{ created_count: number }>(path);
}

export interface GenerateInvoicesResult {
  created: number;
  skipped: number;
  invoices: Invoice[];
}

/**
 * Runs the invoice-generation engine for a single fee structure. One invoice
 * is created per family in scope; families already invoiced for the billing
 * period are skipped. billingPeriod is optional and mainly used for term fees
 * (for example "Term 1 2027"); other frequencies derive their own period.
 */
export async function generateInvoices(
  feeStructureId: string,
  billingPeriod?: string,
): Promise<GenerateInvoicesResult> {
  return api.post<GenerateInvoicesResult>('/invoices/generate', {
    fee_structure_id: feeStructureId,
    ...(billingPeriod ? { billing_period: billingPeriod } : {}),
  });
}

export async function sendInvoiceReminder(invoiceId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`/invoices/${invoiceId}/send-reminder`);
}

export async function downloadInvoicePdf(invoiceId: string): Promise<void> {
  // The server names the file (tax-invoice-<number>.pdf for Australian tax
  // invoices) via Content-Disposition; the fallback only covers header loss.
  return apiDownload(`/invoices/${invoiceId}/pdf`, `invoice-${invoiceId}.pdf`);
}

export async function getFamilyInvoices(familyId: string): Promise<InvoiceWithDetails[]> {
  return api.get<InvoiceWithDetails[]>(`/invoices/family/${familyId}`, { cache: 'no-store' });
}

export async function getOverdueInvoices(): Promise<InvoiceWithDetails[]> {
  return api.get<InvoiceWithDetails[]>('/invoices/overdue', { cache: 'no-store' });
}

// ==================== Payment API Functions ====================

export async function getPayments(): Promise<Payment[]> {
  return api.get<Payment[]>('/payments', { cache: 'no-store' });
}

export async function getPayment(id: string): Promise<Payment> {
  return api.get<Payment>(`/payments/${id}`, { cache: 'no-store' });
}

export async function createPayment(data: CreatePaymentInput): Promise<Payment> {
  return api.post<Payment>('/payments', data);
}

export async function getInvoicePayments(invoiceId: string): Promise<Payment[]> {
  return api.get<Payment[]>(`/payments/invoice/${invoiceId}`, { cache: 'no-store' });
}

// ==================== Fee Structure API Functions ====================

export async function getFeeStructures(): Promise<FeeStructure[]> {
  return api.get<FeeStructure[]>('/fee-structures', { cache: 'no-store' });
}

export async function getFeeStructure(id: string): Promise<FeeStructure> {
  return api.get<FeeStructure>(`/fee-structures/${id}`, { cache: 'no-store' });
}

export async function createFeeStructure(data: CreateFeeStructureInput): Promise<FeeStructure> {
  return api.post<FeeStructure>('/fee-structures', data);
}

export async function updateFeeStructure(id: string, data: UpdateFeeStructureInput): Promise<FeeStructure> {
  return api.patch<FeeStructure>(`/fee-structures/${id}`, data);
}

export async function deleteFeeStructure(id: string): Promise<void> {
  return api.delete<void>(`/fee-structures/${id}`);
}

// ==================== Dashboard API Functions ====================

export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  return api.get<FinanceDashboard>('/finance/dashboard', { cache: 'no-store' });
}

// ==================== Bulk Import ====================

export interface BulkFeeStructureInput {
  name: string;
  description?: string;
  amount: number;
  frequency: FeeFrequencyValue;
  applies_to_type: 'club' | 'squad';
  squad_name?: string;
}

export async function bulkImportFeeStructures(
  feeStructures: BulkFeeStructureInput[],
): Promise<{ created: FeeStructure[]; errors: Array<{ row: number; message: string }> }> {
  return api.post('/fee-structures/bulk', { fee_structures: feeStructures });
}
