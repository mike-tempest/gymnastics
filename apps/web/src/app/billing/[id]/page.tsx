'use client';

import { InvoiceStatus, PaymentMethod, PaymentStatus } from '@club-manager/shared-types';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import InvoiceStatusBadge from '@/components/billing/InvoiceStatusBadge';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useConfirm } from '@/hooks/useConfirm';
import { useFormatters } from '@/hooks/useFormatters';
import {
  getInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoiceReminder,
  createPayment,
  downloadInvoicePdf,
  InvoiceWithDetails,
} from '@/lib/api/finance';
import { getDisplayStatus } from '@/lib/utils/billing';
import { taxRegistrationLabel } from '@/lib/utils/region-labels';

/** Humanises a normalised provider failure cause, e.g. insufficient_funds becomes "Insufficient funds". */
function formatFailureCause(cause: string): string {
  const spaced = cause.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function BillingInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const { confirm, ConfirmDialog } = useConfirm();
  const { formatCurrency, formatDate } = useFormatters();
  const clubRegion = useClubRegion();

  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const fetchInvoice = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getInvoice(invoiceId);
      setInvoice(data);
    } catch (err) {
      setError('Failed to load invoice. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId, fetchInvoice]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    toast.success(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleMarkAsSent = async () => {
    if (!invoice) return;
    
    const confirmed = await confirm({
      title: 'Mark Invoice as Sent',
      description: 'Mark this invoice as sent? The invoice status will be updated to reflect that it has been sent to the family.',
      confirmLabel: 'Mark as Sent',
      variant: 'default',
    });

    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await updateInvoice(invoiceId, { status: InvoiceStatus.SENT });
      await fetchInvoice();
      showSuccess('Invoice marked as sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;
    
    const confirmed = await confirm({
      title: 'Mark Invoice as Paid',
      description: 'Mark this invoice as paid? This will update the invoice status to indicate that payment has been received in full.',
      confirmLabel: 'Mark as Paid',
      variant: 'default',
    });

    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await updateInvoice(invoiceId, { status: InvoiceStatus.PAID });
      await fetchInvoice();
      showSuccess('Invoice marked as paid.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setIsDownloadingPdf(true);
      setError(null);
      await downloadInvoicePdf(invoiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSendReminder = async () => {
    if (!invoice) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await sendInvoiceReminder(invoiceId);
      showSuccess('Payment reminder sent successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reminder');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }
    const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const remainingBalance = invoice.total_amount - totalPaid;
    if (amount > remainingBalance) {
      setError(`Amount exceeds remaining balance of ${formatCurrency(remainingBalance, invoice.currency)}.`);
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await createPayment({
        invoice_id: invoiceId,
        amount,
        method: PaymentMethod.BANK_TRANSFER,
        reference: paymentRef || undefined,
        notes: paymentNotes || undefined,
      });
      await fetchInvoice();
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      showSuccess('Payment recorded successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Invoice',
      description: 'Are you sure you want to delete this invoice? This action cannot be undone and all associated data will be permanently removed.',
      confirmLabel: 'Delete Invoice',
      cancelLabel: 'Keep Invoice',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteInvoice(invoiceId);
      router.push('/billing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            <LoadingSpinner message="Loading invoice..." size="md" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!invoice) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            <ErrorState
              message={error || 'Invoice not found.'}
              onRetry={fetchInvoice}
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  const displayStatus = getDisplayStatus(invoice);
  const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const remainingBalance = invoice.total_amount - totalPaid;
  const isSettled = invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED;

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
    <MainLayout>
      <ConfirmDialog />
      <div className="min-h-dvh bg-canvas p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="no-print">
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/' },
                { label: 'Billing', href: '/billing' },
                { label: `Invoice #${invoice.invoice_id.slice(0, 8).toUpperCase()}` },
              ]}
            />
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-serif text-3xl md:text-4xl text-dark-primary tracking-tight">
                  {isTaxInvoice ? 'Tax Invoice' : 'Invoice'} #{invoice.invoice_id.slice(0, 8).toUpperCase()}
                </h1>
                <InvoiceStatusBadge status={displayStatus} />
              </div>
              <p className="text-dark-primary/60">{invoice.family?.family_name || 'Unknown Family'}</p>
              {taxApplied && taxRegNumber && (
                <p className="text-dark-primary/60 text-sm tabular-nums">
                  {taxRegistrationLabel(clubRegion.country)}: {taxRegNumber}
                </p>
              )}
            </div>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mb-6 p-4 bg-brand/10 border border-brand/40 rounded-xl">
              <p className="text-brand font-semibold">{successMessage}</p>
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl">
              <p className="text-red-400 font-semibold">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Invoice Details Card */}
              <div className="bg-dark-primary rounded-3xl p-6 shadow-lg border border-white/10 invoice-section">
                <h2 className="text-lg font-semibold text-white mb-4">Invoice Details</h2>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">Invoice Date</p>
                    <p className="text-white text-sm font-medium tabular-nums">{formatDate(invoice.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">Due Date</p>
                    <p className={`text-sm font-medium tabular-nums ${displayStatus === 'overdue' ? 'text-red-400' : 'text-white'}`}>
                      {formatDate(invoice.due_date)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">Billed To</p>
                    <p className="text-white text-sm font-medium">{invoice.family?.family_name}</p>
                    {invoice.family?.primary_contact_name && (
                      <p className="text-white/60 text-sm">{invoice.family.primary_contact_name}</p>
                    )}
                    {invoice.family?.primary_contact_email && (
                      <p className="text-white/60 text-sm">{invoice.family.primary_contact_email}</p>
                    )}
                  </div>
                </div>
                {invoice.notes && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-white/60 text-sm">{invoice.notes}</p>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 overflow-hidden invoice-section">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="text-lg font-semibold text-white">Line Items</h2>
                </div>
                
                {/* Desktop Table View (hidden on mobile) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-6 text-xs font-semibold text-white/60 uppercase tracking-wider">Description</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-white/60 uppercase tracking-wider">Quantity</th>
                        <th className="text-right py-3 px-6 text-xs font-semibold text-white/60 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items && invoice.items.length > 0 ? (
                        invoice.items.map((item) => (
                          <tr key={item.item_id} className="border-b border-white/10 last:border-b-0">
                            <td className="py-3.5 px-6">
                              <p className="text-white text-sm">{item.description}</p>
                            </td>
                            <td className="py-3.5 px-6">
                              <span className="text-white/60 text-sm tabular-nums">
                                {item.quantity} x {formatCurrency(item.unit_price, invoice.currency)}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <span className="text-white font-medium text-sm tabular-nums">{formatCurrency(item.total, invoice.currency)}</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-white/60 text-sm">
                            No line items
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      {taxApplied && taxInclusive && (
                        <tr className="border-t border-white/10">
                          <td colSpan={2} className="py-3 px-6 text-right">
                            <span className="text-white/60 text-sm">Includes {taxLabel}</span>
                          </td>
                          <td className="py-3 px-6 text-right">
                            <span className="text-white text-sm tabular-nums">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                          </td>
                        </tr>
                      )}
                      {taxApplied && !taxInclusive && (
                        <>
                          <tr className="border-t border-white/10">
                            <td colSpan={2} className="py-3 px-6 text-right">
                              <span className="text-white/60 text-sm">Subtotal</span>
                            </td>
                            <td className="py-3 px-6 text-right">
                              <span className="text-white text-sm tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="py-3 px-6 text-right">
                              <span className="text-white/60 text-sm">{taxLabel}</span>
                            </td>
                            <td className="py-3 px-6 text-right">
                              <span className="text-white text-sm tabular-nums">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                            </td>
                          </tr>
                        </>
                      )}
                      <tr className="border-t border-white/10">
                        <td colSpan={2} className="py-4 px-6 text-right">
                          <span className="text-white font-semibold">Total:</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-brand font-bold text-lg tabular-nums">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Card View (shown only on mobile) */}
                <div className="md:hidden">
                  {invoice.items && invoice.items.length > 0 ? (
                    <div className="p-4 space-y-3">
                      {invoice.items.map((item) => (
                        <div key={item.item_id} className="p-4 bg-dark-primary rounded-xl border border-white/10">
                          <p className="text-white font-medium text-sm mb-2">{item.description}</p>
                          <div className="flex justify-between items-center text-xs text-white/60">
                            <span className="tabular-nums">{item.quantity} x {formatCurrency(item.unit_price, invoice.currency)}</span>
                            <span className="text-white font-medium text-sm tabular-nums">{formatCurrency(item.total, invoice.currency)}</span>
                          </div>
                        </div>
                      ))}
                      {taxApplied && taxInclusive && (
                        <div className="pt-3 border-t border-white/10">
                          <div className="flex justify-between items-center">
                            <span className="text-white/60 text-sm">Includes {taxLabel}</span>
                            <span className="text-white text-sm tabular-nums">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                          </div>
                        </div>
                      )}
                      {taxApplied && !taxInclusive && (
                        <div className="pt-3 border-t border-white/10 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-white/60 text-sm">Subtotal</span>
                            <span className="text-white text-sm tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/60 text-sm">{taxLabel}</span>
                            <span className="text-white text-sm tabular-nums">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                          </div>
                        </div>
                      )}
                      <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                        <span className="text-white font-semibold">Total:</span>
                        <span className="text-brand font-bold text-lg tabular-nums">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <p className="text-white/60 text-sm">No line items</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment History */}
              <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 overflow-hidden invoice-section">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="text-lg font-semibold text-white">Payment History</h2>
                </div>
                {invoice.payments && invoice.payments.length > 0 ? (
                  <div className="p-6 space-y-3">
                    {invoice.payments.map((payment) => (
                      <div
                        key={payment.payment_id}
                        className="flex items-center justify-between p-4 bg-dark-primary rounded-xl border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M9 12l2 2 4-4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm tabular-nums">{formatCurrency(payment.amount, payment.currency)}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-white/60 text-xs">
                                {payment.payment_method.replace('_', ' ')}
                              </span>
                              <span className="text-white/60 text-xs">&middot;</span>
                              <span className="text-white/60 text-xs tabular-nums">
                                {payment.payment_date ? formatDate(payment.payment_date) : 'Pending'}
                              </span>
                            </div>
                            {payment.status === PaymentStatus.FAILED &&
                              (payment.failure_description || payment.failure_cause) && (
                                <p className="text-red-400 text-xs mt-1">
                                  {payment.failure_description ||
                                    formatFailureCause(payment.failure_cause as string)}
                                </p>
                              )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 bg-brand/10 text-brand rounded text-xs font-medium border border-brand/20">
                            {payment.status.toUpperCase()}
                          </span>
                          {payment.reference_number && (
                            <p className="text-white/60 font-mono text-xs mt-1">Ref: {payment.reference_number}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <svg className="w-10 h-10 text-white/60 mx-auto mb-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-white/60 text-sm">No payments recorded yet</p>
                  </div>
                )}
              </div>

              {/* Record Payment Form (inline) */}
              {showPaymentForm && !isSettled && (
                <div className="bg-dark-primary rounded-3xl p-6 shadow-lg border border-brand/30 no-print">
                  <h2 className="text-lg font-semibold text-white mb-4">Record Payment</h2>
                  <form onSubmit={handleRecordPayment} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="payment-amount" className="block text-sm font-medium text-white/60 mb-1.5">
                          Amount (&pound;)
                        </label>
                        <input
                          id="payment-amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder={remainingBalance.toFixed(2)}
                          className="w-full px-4 py-2.5 bg-dark-primary text-white rounded-lg border border-white/10 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label htmlFor="payment-ref" className="block text-sm font-medium text-white/60 mb-1.5">
                          Reference (optional)
                        </label>
                        <input
                          id="payment-ref"
                          type="text"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          placeholder="Transaction ID"
                          className="w-full px-4 py-2.5 bg-dark-primary text-white rounded-lg border border-white/10 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="payment-notes" className="block text-sm font-medium text-white/60 mb-1.5">
                        Notes (optional)
                      </label>
                      <textarea
                        id="payment-notes"
                        rows={2}
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Additional details..."
                        className="w-full px-4 py-2.5 bg-dark-primary text-white rounded-lg border border-white/10 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowPaymentForm(false)}
                        className="px-4 py-2.5 bg-dark-primary text-white/60 rounded-xl font-semibold text-sm hover:text-white hover:bg-dark-secondary active:scale-[0.97] transition-all border border-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-brand text-dark-primary rounded-full font-bold text-sm hover:bg-brand-light hover:shadow-glow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Recording...' : 'Record Payment'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Payment Summary */}
              <div className="bg-dark-primary rounded-3xl p-6 shadow-lg border border-brand/30 invoice-section">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Payment Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Invoice Total</span>
                    <span className="text-white font-medium tabular-nums">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Total Paid</span>
                    <span className="text-brand font-medium tabular-nums">{formatCurrency(totalPaid, invoice.currency)}</span>
                  </div>
                  <div className="h-px bg-white/5 my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold text-sm">Balance Due</span>
                    <span className={`text-xl font-bold tabular-nums ${
                      remainingBalance === 0
                        ? 'text-brand'
                        : displayStatus === 'overdue'
                        ? 'text-red-400'
                        : 'text-brand'
                    }`}>
                      {formatCurrency(remainingBalance, invoice.currency)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                {invoice.total_amount > 0 && (
                  <div className="mt-4">
                    <div className="h-2 bg-dark-primary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          displayStatus === 'overdue'
                            ? 'bg-red-400'
                            : totalPaid / invoice.total_amount < 0.5
                            ? 'bg-yellow-400'
                            : 'bg-brand'
                        }`}
                        // Dynamic collected-percentage width; cannot be a static Tailwind class
                        style={{ width: `${Math.min((totalPaid / invoice.total_amount) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-white/60 text-xs mt-1.5 tabular-nums">
                      {Math.round((totalPaid / invoice.total_amount) * 100)}% collected
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="bg-dark-primary rounded-3xl p-6 shadow-lg border border-white/10 no-print">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Actions</h3>
                <div className="space-y-2.5">
                  {!isSettled && (
                    <>
                      <button
                        onClick={() => setShowPaymentForm(true)}
                        disabled={isSubmitting || showPaymentForm}
                        className="w-full px-4 py-2.5 bg-brand text-dark-primary rounded-full font-bold text-sm hover:bg-brand-light hover:shadow-glow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Record Payment
                      </button>
                      <button
                        onClick={handleMarkAsPaid}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2.5 bg-brand/10 text-brand rounded-xl font-semibold text-sm hover:bg-brand/20 active:scale-[0.97] transition-all border border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Mark as Paid
                      </button>
                      {displayStatus === 'draft' && (
                        <button
                          onClick={handleMarkAsSent}
                          disabled={isSubmitting}
                          className="w-full px-4 py-2.5 bg-dark-primary/10 text-brand rounded-xl font-semibold text-sm hover:bg-dark-primary/20 active:scale-[0.97] transition-all border border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Mark as Sent
                        </button>
                      )}
                      <button
                        onClick={handleSendReminder}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2.5 bg-yellow-500/10 text-yellow-400 rounded-xl font-semibold text-sm hover:bg-yellow-500/20 active:scale-[0.97] transition-all border border-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Sending...' : 'Send Reminder'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isSubmitting || isDownloadingPdf}
                    className="w-full px-4 py-2.5 bg-dark-primary text-white rounded-xl font-semibold text-sm hover:bg-white/10 active:scale-[0.97] transition-all border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
                  </button>
                  <button
                    onClick={() => window.print()}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 bg-dark-primary text-white rounded-xl font-semibold text-sm hover:bg-white/10 active:scale-[0.97] transition-all border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Print / PDF
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl font-semibold text-sm hover:bg-red-500/20 active:scale-[0.97] transition-all border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
