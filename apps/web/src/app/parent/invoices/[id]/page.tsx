'use client';

import { FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import InvoiceStatusBadge from '@/components/billing/InvoiceStatusBadge';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { InvoiceWithDetails } from '@/lib/api/finance';
import { fetchParentInvoice, downloadParentInvoicePdf } from '@/lib/api/parent';
import { getDisplayStatus } from '@/lib/utils/billing';
import { taxRegistrationLabel } from '@/lib/utils/region-labels';

interface PageProps {
  params: { id: string };
}

export default function InvoiceDetailPage({ params }: PageProps) {
  const { id } = params;
  const { formatCurrency, formatDate } = useFormatters();
  const clubRegion = useClubRegion();
  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadParentInvoicePdf(id);
    } catch {
      toast.error('We could not download the PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  useEffect(() => {
    async function loadInvoice() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchParentInvoice(id);
        setInvoice(data);
      } catch (err) {
        setError('We could not load this invoice. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadInvoice();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas p-4 md:p-8 flex items-center justify-center">
        <LoadingSpinner message="Loading your invoice..." />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-dvh bg-canvas p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Parent Portal', href: '/parent' },
              { label: 'Invoices', href: '/parent/invoices' },
              { label: 'Invoice' },
            ]}
          />
          {error ? (
            <ErrorState message={error} onRetry={() => window.location.reload()} />
          ) : (
            <EmptyState
              icon={FileText}
              title="Invoice not found"
              description="We could not find this invoice. It may have been removed."
              actionLabel="Back to invoices"
              actionHref="/parent/invoices"
            />
          )}
        </div>
      </div>
    );
  }

  const displayStatus = getDisplayStatus(invoice);
  const showPayButton = invoice.status === 'pending' || invoice.status === 'overdue';

  // Tax invoice presentation. Australian clubs with tax applied and an ABN on
  // file must issue a document headed "Tax Invoice"; the registration line
  // (ABN, VAT number, GST/HST number) renders for any country once tax is
  // applied and a number is stored. Tax-inclusive clubs show the tax within
  // the total ("Includes GST") rather than as an added line. GB clubs with no
  // tax configuration see none of this.
  const taxApplied = Number(invoice.tax_amount) > 0;
  const taxRegNumber = clubRegion.club?.tax_registration_number ?? null;
  const isTaxInvoice = taxApplied && !!taxRegNumber && clubRegion.country === 'AU';
  const taxInclusive = clubRegion.club?.tax_inclusive === true;
  const taxLabel = invoice.tax_label ?? clubRegion.club?.tax_label ?? 'Tax';

  return (
    <div className="min-h-dvh bg-canvas p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: 'Parent Portal', href: '/parent' },
            { label: 'Invoices', href: '/parent/invoices' },
            { label: invoice.invoice_number },
          ]}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              {isTaxInvoice && (
                <p className="text-brand text-sm font-semibold uppercase tracking-wider mb-1">
                  Tax Invoice
                </p>
              )}
              <h1 className="font-serif text-3xl md:text-4xl text-dark-primary mb-2">
                {invoice.invoice_number}
              </h1>
              <div className="flex items-center gap-3">
                <InvoiceStatusBadge status={displayStatus} />
                {displayStatus === 'overdue' && (
                  <span className="text-red-500 text-sm font-medium">Payment overdue</span>
                )}
              </div>
              {taxApplied && taxRegNumber && (
                <p className="text-grey-600 text-sm tabular-nums mt-2">
                  {taxRegistrationLabel(clubRegion.country)}: {taxRegNumber}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto sm:items-start">
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="w-full sm:w-auto px-6 py-3 min-h-[44px] bg-dark-primary text-white rounded-button font-bold hover:bg-dark-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
              </button>
              {showPayButton && (
                <div className="w-full sm:w-auto">
                  <button
                    disabled
                    className="w-full sm:w-auto px-6 py-3 min-h-[44px] bg-white/10 text-white/40 rounded-button font-bold cursor-not-allowed"
                    title="Online payment coming soon"
                  >
                    Pay now
                  </button>
                  <p className="text-grey-600 text-xs mt-1 text-center sm:text-right">
                    Online payment coming soon
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Invoice Info */}
          <div className="bg-dark-primary rounded-3xl p-4 md:p-6 shadow-lg border border-white/10">
            <h3 className="font-serif text-lg text-white mb-4">Invoice details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-text-tertiary text-xs mb-1">Invoice number</p>
                <p className="text-white font-medium tabular-nums">{invoice.invoice_number}</p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-1">Issued date</p>
                <p className="text-white font-medium tabular-nums">
                  {formatDate(invoice.issued_date)}
                </p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-1">Due date</p>
                <p
                  className={`font-medium tabular-nums ${
                    displayStatus === 'overdue' ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {formatDate(invoice.due_date)}
                </p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-1">Status</p>
                <InvoiceStatusBadge status={displayStatus} />
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-dark-primary rounded-3xl p-4 md:p-6 shadow-lg border border-white/10">
            <h3 className="font-serif text-lg text-white mb-4">Customer details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-text-tertiary text-xs mb-1">Family name</p>
                <p className="text-white font-medium">{invoice.family?.family_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-1">Primary contact</p>
                <p className="text-white font-medium">
                  {invoice.family?.primary_contact_name || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-1">Email</p>
                <p className="text-white font-medium break-all">
                  {invoice.family?.primary_contact_email || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Amount Summary */}
          <div className="bg-dark-primary rounded-3xl p-4 md:p-6 shadow-lg border border-white/10">
            <h3 className="font-serif text-lg text-white mb-4">Amount summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-text-tertiary text-sm">Subtotal</span>
                <span className="text-white font-medium tabular-nums">
                  {formatCurrency(invoice.subtotal, invoice.currency)}
                </span>
              </div>
              {taxApplied && (
                <div className="flex justify-between">
                  <span className="text-text-tertiary text-sm">
                    {taxInclusive ? `Includes ${taxLabel}` : taxLabel}
                  </span>
                  <span className="text-white font-medium tabular-nums">
                    {formatCurrency(invoice.tax_amount, invoice.currency)}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">Total</span>
                  <span className="font-serif text-2xl text-brand tabular-nums">
                    {formatCurrency(invoice.total_amount, invoice.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-8">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-xl md:text-2xl text-white">Line items</h2>
          </div>
          <div className="p-4 md:p-6">
            {invoice.items && invoice.items.length > 0 ? (
              <>
                {/* Mobile card layout */}
                <div className="md:hidden space-y-3">
                  {invoice.items.map((item) => (
                    <div key={item.item_id} className="bg-white/5 rounded-2xl p-4 space-y-2">
                      <p className="text-white font-semibold">{item.description}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-tertiary tabular-nums">
                          Qty: {item.quantity}
                        </span>
                        <span className="text-text-tertiary tabular-nums">
                          {formatCurrency(item.unit_price, invoice.currency)} each
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-text-tertiary text-sm">Line total</span>
                        <span className="text-white font-semibold tabular-nums">
                          {formatCurrency(item.total, invoice.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="bg-white/5 rounded-2xl p-4 space-y-3 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold">Subtotal</span>
                      <span className="text-white font-semibold tabular-nums">
                        {formatCurrency(invoice.subtotal, invoice.currency)}
                      </span>
                    </div>
                    {taxApplied && (
                      <div className="flex items-center justify-between">
                        <span className="text-text-tertiary text-sm">
                          {taxInclusive ? `Includes ${taxLabel}` : taxLabel}
                        </span>
                        <span className="text-white tabular-nums">
                          {formatCurrency(invoice.tax_amount, invoice.currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <span className="text-white font-bold">Total amount</span>
                      <span className="font-serif text-brand text-xl tabular-nums">
                        {formatCurrency(invoice.total_amount, invoice.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop table layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-text-tertiary text-sm border-b border-white/10">
                        <th className="pb-3 font-medium">Description</th>
                        <th className="pb-3 font-medium text-center">Quantity</th>
                        <th className="pb-3 font-medium text-right">Unit price</th>
                        <th className="pb-3 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => (
                        <tr key={item.item_id} className="border-b border-white/10 last:border-0">
                          <td className="py-4 text-white">{item.description}</td>
                          <td className="py-4 text-white text-center tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-4 text-white text-right tabular-nums">
                            {formatCurrency(item.unit_price, invoice.currency)}
                          </td>
                          <td className="py-4 text-white text-right font-semibold tabular-nums">
                            {formatCurrency(item.total, invoice.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/10">
                        <td colSpan={3} className="pt-4 text-white font-semibold text-right">
                          Subtotal
                        </td>
                        <td className="pt-4 text-white font-semibold text-right tabular-nums">
                          {formatCurrency(invoice.subtotal, invoice.currency)}
                        </td>
                      </tr>
                      {taxApplied && (
                        <tr>
                          <td colSpan={3} className="pt-2 text-text-tertiary text-sm text-right">
                            {taxInclusive ? `Includes ${taxLabel}` : taxLabel}
                          </td>
                          <td className="pt-2 text-white text-right tabular-nums">
                            {formatCurrency(invoice.tax_amount, invoice.currency)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-white/10">
                        <td colSpan={3} className="pt-3 text-white font-bold text-right">
                          Total amount
                        </td>
                        <td className="pt-3 text-brand text-xl font-bold text-right font-serif tabular-nums">
                          {formatCurrency(invoice.total_amount, invoice.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="w-12 h-12 text-text-tertiary mb-4" />
                <p className="text-white font-semibold mb-1">No line items</p>
                <p className="text-text-secondary text-sm">This invoice has no itemised charges.</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-8">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-xl md:text-2xl text-white">Payment history</h2>
          </div>
          <div className="p-4 md:p-6">
            {invoice.status === 'paid' ? (
              <div className="p-4 bg-brand/10 border border-brand/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-brand"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-brand font-semibold">Payment received</p>
                    <p className="text-white/70 text-sm tabular-nums">
                      {formatCurrency(invoice.total_amount, invoice.currency)} paid on{' '}
                      {formatDate(invoice.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg
                  className="w-12 h-12 text-text-tertiary mb-4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-white font-semibold mb-1">No payments recorded</p>
                <p className="text-text-secondary text-sm">
                  Payments will appear here once processed.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
            <div className="p-4 md:p-6 border-b border-white/10">
              <h2 className="font-serif text-xl md:text-2xl text-white">Notes</h2>
            </div>
            <div className="p-4 md:p-6">
              <p className="text-white">{invoice.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
