'use client';

import { InvoiceStatus } from '@club-manager/shared-types';
import { FileText } from 'lucide-react';

import EmptyState from '@/components/ui/empty-state';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { InvoiceWithDetails } from '@/lib/api/finance';

interface InvoiceTableProps {
  invoices: InvoiceWithDetails[];
  isLoading?: boolean;
  onRowClick?: (invoiceId: string) => void;
}

// Maps an invoice status to its semantic badge classes
function getStatusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case InvoiceStatus.PENDING:
      return 'bg-info/20 text-info border-info/40';
    case InvoiceStatus.PAID:
      return 'bg-success/20 text-success border-success/40';
    case InvoiceStatus.DRAFT:
    case InvoiceStatus.CANCELLED:
    default:
      return 'bg-grey-500/20 text-text-tertiary border-grey-500/40';
  }
}

// Helper function to check if invoice is overdue
function isOverdue(invoice: InvoiceWithDetails): boolean {
  if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
    return false;
  }
  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

export default function InvoiceTable({ invoices, isLoading = false, onRowClick }: InvoiceTableProps) {
  const { formatCurrency, formatDate } = useFormatters();

  if (isLoading) {
    return <LoadingSpinner message="Loading invoices..." size="md" />;
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices found"
        description="Create your first invoice to get started."
      />
    );
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {invoices.map((invoice) => {
          const overdue = isOverdue(invoice);
          return (
            <div
              key={invoice.invoice_id}
              role="button"
              tabIndex={0}
              onClick={() => onRowClick?.(invoice.invoice_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick?.(invoice.invoice_id);
                }
              }}
              aria-label={`Invoice INV-${invoice.invoice_id.slice(0, 8).toUpperCase()} for ${invoice.family?.family_name || 'Unknown Family'}, ${formatCurrency(invoice.total_amount, invoice.currency)}`}
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 active:bg-white/10 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <span className="text-brand font-mono font-semibold text-sm">
                    INV-{invoice.invoice_id.slice(0, 8).toUpperCase()}
                  </span>
                  <p className="text-white font-medium text-sm mt-1">
                    {invoice.family?.family_name || 'Unknown Family'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${
                    overdue && invoice.status === InvoiceStatus.PENDING
                      ? 'bg-danger/20 text-danger border-danger/40'
                      : getStatusBadgeClass(invoice.status)
                  }`}
                >
                  {overdue && invoice.status === InvoiceStatus.PENDING ? 'OVERDUE' : invoice.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-white font-semibold text-lg tabular-nums">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                <span className={`text-sm tabular-nums ${overdue ? 'text-danger font-semibold' : 'text-text-secondary'}`}>
                  Due {formatDate(invoice.due_date)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-4 px-6 text-sm font-semibold text-white">Invoice #</th>
              <th className="text-left py-4 px-6 text-sm font-semibold text-white">Family</th>
              <th className="text-left py-4 px-6 text-sm font-semibold text-white">Amount</th>
              <th className="text-left py-4 px-6 text-sm font-semibold text-white">Due Date</th>
              <th className="text-left py-4 px-6 text-sm font-semibold text-white">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const overdue = isOverdue(invoice);
              return (
                <tr
                  key={invoice.invoice_id}
                  tabIndex={0}
                  onClick={() => onRowClick?.(invoice.invoice_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick?.(invoice.invoice_id);
                    }
                  }}
                  aria-label={`Invoice INV-${invoice.invoice_id.slice(0, 8).toUpperCase()} for ${invoice.family?.family_name || 'Unknown Family'}, ${formatCurrency(invoice.total_amount, invoice.currency)}`}
                  className="border-b border-white/10 hover:bg-white/10 transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-6">
                    <span className="text-brand font-mono font-semibold">
                      INV-{invoice.invoice_id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div>
                      <p className="text-white font-medium">{invoice.family?.family_name || 'Unknown Family'}</p>
                      {invoice.family?.primary_contact_name && (
                        <p className="text-text-secondary text-sm">{invoice.family.primary_contact_name}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-white font-semibold text-lg tabular-nums">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div>
                      <p className={`text-sm tabular-nums ${overdue ? 'text-danger font-semibold' : 'text-text-secondary'}`}>
                        {formatDate(invoice.due_date)}
                      </p>
                      {overdue && (
                        <p className="text-xs text-danger mt-1">Overdue</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border inline-block ${
                        overdue && invoice.status === InvoiceStatus.PENDING
                          ? 'bg-danger/20 text-danger border-danger/40'
                          : getStatusBadgeClass(invoice.status)
                      }`}
                    >
                      {overdue && invoice.status === InvoiceStatus.PENDING ? 'OVERDUE' : invoice.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
