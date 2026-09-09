'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import InvoiceStatusBadge from '@/components/billing/InvoiceStatusBadge';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { InvoiceWithDetails } from '@/lib/api/finance';
import { fetchParentInvoices } from '@/lib/api/parent';
import { getDisplayStatus, type StatusKey } from '@/lib/utils/billing';

type FilterTab = 'all' | 'sent' | 'paid' | 'overdue';

export default function InvoicesListPage() {
  const { formatCurrency, formatDate } = useFormatters();
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoices() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchParentInvoices();
        setInvoices(data);
      } catch (err) {
        setError('We could not load your invoices. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    loadInvoices();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas p-4 md:p-8 flex items-center justify-center">
        <LoadingSpinner message="Loading your invoices..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-canvas p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  // Use the same display-status logic as the badges so tabs, counts and
  // badges always agree (a pending invoice past its due date reads as overdue).
  const withStatus = invoices.map((inv) => ({
    invoice: inv,
    displayStatus: getDisplayStatus(inv),
  }));

  const filteredInvoices =
    activeTab === 'all'
      ? invoices
      : withStatus.filter((x) => x.displayStatus === activeTab).map((x) => x.invoice);

  const totalInvoices = invoices.length;
  const totalOutstanding = withStatus
    .filter((x) => x.displayStatus === 'sent' || x.displayStatus === 'overdue')
    .reduce((sum, x) => sum + Number(x.invoice.total_amount), 0);
  const totalPaid = withStatus
    .filter((x) => x.displayStatus === 'paid')
    .reduce((sum, x) => sum + Number(x.invoice.total_amount), 0);

  const countByStatus = (status: StatusKey) =>
    withStatus.filter((x) => x.displayStatus === status).length;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totalInvoices },
    { key: 'sent', label: 'Pending', count: countByStatus('sent') },
    { key: 'paid', label: 'Paid', count: countByStatus('paid') },
    { key: 'overdue', label: 'Overdue', count: countByStatus('overdue') },
  ];

  return (
    <div className="min-h-dvh bg-canvas p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumb items={[{ label: 'Parent Portal', href: '/parent' }, { label: 'Invoices' }]} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl text-dark-primary mb-1">Invoices</h1>
          <p className="text-grey-600 text-lg">View and manage your family invoices</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-dark-primary rounded-3xl p-6 md:p-8 shadow-lg border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-brand"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Total invoices</p>
            <p className="font-serif text-4xl text-brand tabular-nums">{totalInvoices}</p>
          </div>

          <div className="bg-dark-primary rounded-3xl p-6 md:p-8 shadow-lg border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-yellow-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Total outstanding</p>
            <p className="font-serif text-4xl text-yellow-400 tabular-nums">
              {formatCurrency(totalOutstanding)}
            </p>
          </div>

          <div className="bg-dark-primary rounded-3xl p-6 md:p-8 shadow-lg border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-brand"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Total paid</p>
            <p className="font-serif text-4xl text-brand tabular-nums">
              {formatCurrency(totalPaid)}
            </p>
          </div>
        </div>

        {/* Filter Tabs + Invoice List */}
        <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
          <div className="p-4 md:p-6 border-b border-white/10">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all ${
                    activeTab === tab.key
                      ? 'bg-brand text-dark-primary'
                      : 'bg-dark-primary/80 text-grey-300 border border-white/10 hover:text-white hover:border-brand/40'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Invoice List */}
          <div className="p-4 md:p-6">
            {filteredInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="When your club issues an invoice, it will appear here so you can keep track of what is due."
              />
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map((invoice) => {
                  const displayStatus = getDisplayStatus(invoice);
                  return (
                    <Link
                      key={invoice.invoice_id}
                      href={`/parent/invoices/${invoice.invoice_id}`}
                      className="block p-5 bg-white/5 rounded-2xl hover:bg-white/10 active:bg-white/5 active:scale-[0.98] transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-semibold group-hover:text-brand transition-colors">
                              {invoice.invoice_number}
                            </h3>
                            <InvoiceStatusBadge status={displayStatus} />
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-text-tertiary tabular-nums">
                            <span>Issued {formatDate(invoice.issued_date)}</span>
                            <span>Due {formatDate(invoice.due_date)}</span>
                          </div>
                          {invoice.notes && (
                            <p className="text-text-tertiary text-sm mt-2">{invoice.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <p className="font-serif text-2xl md:text-3xl text-white tabular-nums">
                            {formatCurrency(invoice.total_amount, invoice.currency)}
                          </p>
                          <svg
                            className="w-5 h-5 text-text-tertiary group-hover:text-brand transition-colors flex-shrink-0"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
