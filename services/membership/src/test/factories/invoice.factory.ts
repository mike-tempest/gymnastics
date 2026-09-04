import { Invoice, InvoiceStatus } from '../../modules/finance/invoices/entities/invoice.entity';

let counter = 0;

export function buildInvoice(overrides?: Partial<Invoice>): Invoice {
  counter += 1;
  const now = new Date();

  const defaults: Invoice = {
    invoice_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    family_id: crypto.randomUUID(),
    invoice_number: `INV-${String(counter).padStart(5, '0')}`,
    subtotal: 50.0,
    tax_amount: 0,
    total_amount: 50.0,
    currency: 'GBP',
    due_date: new Date('2026-05-01'),
    issued_date: new Date('2026-04-01'),
    status: InvoiceStatus.PENDING,
    notes: null,
    fee_structure_id: null,
    billing_period: null,
    created_at: now,
    updated_at: now,
  };

  return { ...defaults, ...overrides };
}
