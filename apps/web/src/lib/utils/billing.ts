import { InvoiceStatus } from '@swim-nexus/shared-types';

import { InvoiceWithDetails } from '@/lib/api/finance';

export type StatusKey = 'draft' | 'sent' | 'paid' | 'overdue';

// Money and date formatting live in lib/utils/format-regional.ts, bound to the
// club's region via the useFormatters() hook.

export function getDisplayStatus(invoice: InvoiceWithDetails): StatusKey {
  if (invoice.status === InvoiceStatus.PAID) return 'paid';
  if (invoice.status === InvoiceStatus.DRAFT) return 'draft';
  if (invoice.status === InvoiceStatus.OVERDUE) return 'overdue';
  if (invoice.status === InvoiceStatus.SENT) return 'sent';
  if (invoice.status === InvoiceStatus.PENDING) {
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate < today) return 'overdue';
    return 'sent';
  }
  return 'draft';
}
