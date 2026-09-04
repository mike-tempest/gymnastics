'use client';

import { InvoiceStatus } from '@swim-nexus/shared-types';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import BillingStatsCard from '@/components/billing/BillingStatsCard';
import ConnectPaymentsBanner from '@/components/billing/ConnectPaymentsBanner';
import InvoiceStatusBadge from '@/components/billing/InvoiceStatusBadge';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { useFormatters } from '@/hooks/useFormatters';
import { generateMonthlyInvoices, updateInvoice } from '@/lib/api/finance';
import { useInvoices, useFamilies } from '@/lib/hooks';
import { getDisplayStatus } from '@/lib/utils/billing';

export default function BillingPage() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const { formatCurrency, formatDate } = useFormatters();
  const { data: invoicesData, isLoading: invoicesLoading, error: invoicesError, refetch: refetchInvoices } = useInvoices();
  const { data: familiesData, isLoading: familiesLoading } = useFamilies();
  const invoices = invoicesData || [];
  const families = familiesData || [];
  const isLoading = invoicesLoading || familiesLoading;

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedFamily, setSelectedFamily] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);

  // Generate monthly
  const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);

  const handleGenerateMonthlyInvoices = async () => {
    const confirmed = await confirm({
      title: 'Generate Monthly Invoices',
      description: 'Generate monthly invoices for all active families? This will create invoices based on fee structures.',
      confirmLabel: 'Generate Invoices',
      variant: 'default',
    });

    if (!confirmed) return;

    try {
      setIsGeneratingInvoices(true);
      setError(null);
      const result = await generateMonthlyInvoices();
      refetchInvoices();
      setSuccessMessage(`Successfully generated ${result.created_count} invoices.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate monthly invoices');
    } finally {
      setIsGeneratingInvoices(false);
    }
  };

  // Filter invoices
  const filteredInvoices = invoices
    .filter((invoice) => {
      if (selectedStatus) {
        const displayStatus = getDisplayStatus(invoice);
        if (selectedStatus === 'sent') {
          if (displayStatus !== 'sent') return false;
        } else if (displayStatus !== selectedStatus) return false;
      }
      if (selectedFamily && invoice.family_id !== selectedFamily) return false;
      if (dateFrom) {
        const invoiceDate = new Date(invoice.due_date);
        if (invoiceDate < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const invoiceDate = new Date(invoice.due_date);
        if (invoiceDate > new Date(dateTo)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

  // Stats
  const totalOutstanding = invoices
    .filter((inv) => {
      const s = getDisplayStatus(inv);
      return s === 'sent' || s === 'overdue';
    })
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const overdueCount = invoices.filter((inv) => getDisplayStatus(inv) === 'overdue').length;

  const revenueCollected = invoices
    .filter((inv) => getDisplayStatus(inv) === 'paid')
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const draftCount = invoices.filter((inv) => getDisplayStatus(inv) === 'draft').length;

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((inv) => inv.invoice_id)));
    }
  };

  const handleBulkAction = async (action: 'sent' | 'paid') => {
    if (selectedIds.size === 0) return;
    const label = action === 'sent' ? 'sent' : 'paid';
    
    const confirmed = await confirm({
      title: `Mark ${selectedIds.size} Invoice${selectedIds.size !== 1 ? 's' : ''} as ${label.charAt(0).toUpperCase() + label.slice(1)}`,
      description: `Are you sure you want to mark ${selectedIds.size} invoice${selectedIds.size !== 1 ? 's' : ''} as ${label}? This action will update the invoice status${selectedIds.size !== 1 ? 'es' : ''}.`,
      confirmLabel: `Mark as ${label.charAt(0).toUpperCase() + label.slice(1)}`,
      variant: 'default',
    });

    if (!confirmed) return;

    try {
      setIsBulkActing(true);
      setError(null);

      const statusMap: Record<string, InvoiceStatus> = { sent: InvoiceStatus.SENT, paid: InvoiceStatus.PAID };
      await Promise.all(
        Array.from(selectedIds).map((id) => updateInvoice(id, { status: statusMap[action] }))
      );

      refetchInvoices();
      setSelectedIds(new Set());
      setSuccessMessage(`${selectedIds.size} invoice(s) marked as ${label}.`);
      toast.success(`${selectedIds.size} invoice(s) marked as ${label}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update invoices';
      setError(message);
      toast.error(message);
    } finally {
      setIsBulkActing(false);
    }
  };

  return (
    <MainLayout>
      <ConfirmDialog />
      <div className="min-h-dvh bg-canvas p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Billing' },
            ]}
          />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl text-dark-primary mb-1">Billing</h1>
              <p className="text-grey-600 text-lg">Manage invoices and track payments</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGenerateMonthlyInvoices}
                disabled={isGeneratingInvoices}
                className="px-5 py-3 min-h-[44px] bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-dark-primary transition-all border border-grey-200 hover:border-brand/40 flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingInvoices ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Generate Monthly</span>
                  </>
                )}
              </button>
              <Link
                href="/billing/create"
                className="px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-full font-bold hover:bg-brand-light transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 4v16m8-8H4" />
                </svg>
                <span>New Invoice</span>
              </Link>
            </div>
          </div>

          <ConnectPaymentsBanner />

          {/* Messages */}
          {successMessage && (
            <div className="mb-6 p-4 bg-brand/10 border border-brand/40 rounded-xl">
              <p className="text-brand font-semibold">{successMessage}</p>
            </div>
          )}
          {(error || invoicesError) && <ErrorState message={error || invoicesError || 'Failed to load invoices. Please try again.'} onRetry={() => { setError(null); refetchInvoices(); }} />}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <BillingStatsCard
              label="Total Outstanding"
              value={invoicesError ? '\u2014' : formatCurrency(totalOutstanding)}
              valueColour="text-yellow-400"
              iconBg="bg-yellow-500/10"
              iconColour="text-yellow-400"
              icon={
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <BillingStatsCard
              label="Overdue"
              value={invoicesError ? '\u2014' : String(overdueCount)}
              valueColour="text-red-400"
              iconBg="bg-red-500/10"
              iconColour="text-red-400"
              icon={
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
            <BillingStatsCard
              label="Revenue Collected"
              value={invoicesError ? '\u2014' : formatCurrency(revenueCollected)}
              valueColour="text-lime"
              iconBg="bg-lime/10"
              iconColour="text-lime"
              icon={
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <BillingStatsCard
              label="Drafts"
              value={invoicesError ? '\u2014' : String(draftCount)}
              valueColour="text-white/60"
              iconBg="bg-white/10"
              iconColour="text-white/60"
              icon={
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
            />
          </div>

          {/* Status Tabs + Family Filter + Date Range */}
          <div className="flex flex-col gap-3 sm:gap-4 mb-6">
            {/* Status tabs - scrollable on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
              {[
                { key: '', label: 'All' },
                { key: 'paid', label: 'Paid' },
                { key: 'sent', label: 'Unpaid' },
                { key: 'overdue', label: 'Overdue' },
                { key: 'draft', label: 'Draft' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedStatus(tab.key)}
                  className={`px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                    selectedStatus === tab.key
                      ? 'bg-brand text-dark-primary'
                      : 'bg-dark-primary/80 text-grey-300 border border-grey-200 hover:text-white hover:border-brand/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Family filter - full width on mobile */}
            <div className="w-full sm:w-auto">
              <label htmlFor="family-filter" className="sr-only">Filter by family</label>
              <select
                id="family-filter"
                value={selectedFamily}
                onChange={(e) => setSelectedFamily(e.target.value)}
                className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-dark-primary/80 text-white rounded-xl border border-grey-200 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none text-sm"
              >
                <option value="">All Families</option>
                {families.map((family) => (
                  <option key={family.family_id} value={family.family_id}>
                    {family.family_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range - stacked on mobile, inline on larger screens */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label htmlFor="date-from" className="text-sm font-medium text-dark-primary/60">
                  From
                </label>
                <input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-dark-primary/80 text-white rounded-xl border border-grey-200 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label htmlFor="date-to" className="text-sm font-medium text-dark-primary/60">
                  To
                </label>
                <input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-dark-primary/80 text-white rounded-xl border border-grey-200 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-dark-primary rounded-3xl p-4 border border-brand/30 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-white text-sm font-medium">
                {selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={() => handleBulkAction('sent')}
                  disabled={isBulkActing}
                  className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-brand/10 text-brand rounded-xl font-semibold text-sm hover:bg-brand/20 active:scale-[0.97] transition-all border border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark as Sent
                </button>
                <button
                  onClick={() => handleBulkAction('paid')}
                  disabled={isBulkActing}
                  className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-brand/10 text-brand rounded-xl font-semibold text-sm hover:bg-brand/20 active:scale-[0.97] transition-all border border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark as Paid
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-dark-primary text-white/60 rounded-xl font-semibold text-sm hover:text-white hover:bg-dark-secondary active:scale-[0.97] transition-all border border-white/10"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Invoices Table */}
          <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="font-serif text-2xl text-white">
                All Invoices
                <span className="text-white/60 text-sm font-normal ml-2">
                  ({filteredInvoices.length} {filteredInvoices.length === 1 ? 'invoice' : 'invoices'})
                </span>
              </h2>
            </div>

            {isLoading ? (
              <TableSkeleton />
            ) : invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Generate invoices for your families and track who has paid. No more chasing standing orders."
                hint="You can create invoices individually or generate them in bulk for all active swimmers."
                actionLabel="Create Invoice"
                actionHref="/billing/create"
              />
            ) : filteredInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices found"
                description="No invoices match your current filters."
              />
            ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden p-4 space-y-3">
                {filteredInvoices.map((invoice) => {
                  const displayStatus = getDisplayStatus(invoice);
                  return (
                    <div
                      key={invoice.invoice_id}
                      onClick={() => router.push(`/billing/${invoice.invoice_id}`)}
                      className="p-4 bg-dark-primary rounded-xl hover:bg-white/5 active:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(invoice.invoice_id)}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(invoice.invoice_id); }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-white/20 bg-dark-primary text-brand focus:ring-brand focus:ring-offset-0 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-brand font-mono font-semibold text-sm group-hover:text-brand-light transition-colors">
                              INV-{invoice.invoice_id.slice(0, 8).toUpperCase()}
                            </span>
                            <p className="text-white font-medium text-sm mt-1">{invoice.family?.family_name || 'Unknown Family'}</p>
                          </div>
                        </div>
                        <InvoiceStatusBadge status={displayStatus} />
                      </div>
                      <div className="flex items-end justify-between">
                        <p className="font-serif text-3xl text-white">{formatCurrency(invoice.total_amount, invoice.currency)}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${displayStatus === 'overdue' ? 'text-red-400 font-medium' : 'text-white/60'}`}>
                            Due {formatDate(invoice.due_date)}
                          </span>
                          <svg className="w-4 h-4 text-text-tertiary group-hover:text-brand transition-colors flex-shrink-0" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
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
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-white/20 bg-dark-primary text-brand focus:ring-brand focus:ring-offset-0"
                        />
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-white/60 uppercase tracking-wider">Invoice</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-white/60 uppercase tracking-wider">Family / Member</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-white/60 uppercase tracking-wider">Amount</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-white/60 uppercase tracking-wider">Due Date</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-white/60 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => {
                      const displayStatus = getDisplayStatus(invoice);
                      return (
                        <tr
                          key={invoice.invoice_id}
                          className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(invoice.invoice_id)}
                              onChange={() => toggleSelect(invoice.invoice_id)}
                              className="rounded border-white/20 bg-dark-primary text-brand focus:ring-brand focus:ring-offset-0"
                            />
                          </td>
                          <td className="py-4 px-6" onClick={() => router.push(`/billing/${invoice.invoice_id}`)}>
                            <span className="text-brand font-mono font-semibold text-sm">
                              INV-{invoice.invoice_id.slice(0, 8).toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-6" onClick={() => router.push(`/billing/${invoice.invoice_id}`)}>
                            <p className="text-white font-medium text-sm">{invoice.family?.family_name || 'Unknown Family'}</p>
                            {invoice.family?.primary_contact_name && (
                              <p className="text-text-tertiary text-xs mt-0.5">{invoice.family.primary_contact_name}</p>
                            )}
                          </td>
                          <td className="py-4 px-6" onClick={() => router.push(`/billing/${invoice.invoice_id}`)}>
                            <span className="text-white font-semibold">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                          </td>
                          <td className="py-4 px-6" onClick={() => router.push(`/billing/${invoice.invoice_id}`)}>
                            <span className={`text-sm ${displayStatus === 'overdue' ? 'text-red-400 font-medium' : 'text-white/60'}`}>
                              {formatDate(invoice.due_date)}
                            </span>
                          </td>
                          <td className="py-4 px-6" onClick={() => router.push(`/billing/${invoice.invoice_id}`)}>
                            <InvoiceStatusBadge status={displayStatus} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      </div>


    </MainLayout>
  );
}
