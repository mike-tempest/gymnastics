'use client';

import { InvoiceStatus } from '@club-manager/shared-types';
import { CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import InvoiceStatusBadge from '@/components/billing/InvoiceStatusBadge';
import MainLayout from '@/components/layout/MainLayout';
import { MandateSetup } from '@/components/mandates/MandateSetup';
import { MandateStatus } from '@/components/mandates/MandateStatus';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { getParentProfile } from '@/lib/api/parent';
import { useInvoices } from '@/lib/hooks';
import { getDisplayStatus } from '@/lib/utils/billing';
import { directDebitScheme } from '@/lib/utils/direct-debit';
import { paymentMethodLabel } from '@/lib/utils/region-labels';

export default function PaymentsPage() {
  const router = useRouter();
  const { country, club, isLoading: clubLoading } = useClubRegion();
  const { formatCurrency, formatDate } = useFormatters();
  const scheme = directDebitScheme(country);
  const isBacs = scheme === 'bacs';
  const isBecs = scheme === 'becs';
  const methodLabel = paymentMethodLabel(country);
  // Stripe clubs collect through a Stripe-hosted page where the payer may
  // authorise a card OR a bank debit, so scheme-specific direct-debit copy
  // may not apply. GoCardless and unknown providers keep today's copy.
  const isStripe = club?.payment_provider === 'stripe';
  // An explicit null from /clubs/me means the club has no active payment
  // connection, so the settings tab shows an informational state instead of a
  // setup flow that could only fail. Strictly null: an absent field and a
  // still-loading or failed club fetch keep the existing behaviour, so the
  // message never flashes while the club is loading.
  const paymentsNotSetUp = !clubLoading && club != null && club.payment_provider === null;
  const settingsHeading = isStripe ? 'automatic payments' : methodLabel;
  const settlementTiming = isBecs ? '2-3 business days' : '3-5 working days';
  const [activeTab, setActiveTab] = useState<'invoices' | 'settings'>('invoices');
  const { data: invoicesData, isLoading: loading, error, refetch: loadInvoices } = useInvoices();
  const invoices = invoicesData || [];
  const [filterStatus, setFilterStatus] = useState<'all' | InvoiceStatus>('all');
  const [showSetup, setShowSetup] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [familyId, setFamilyId] = useState<string>('');

  useEffect(() => {
    getParentProfile()
      .then((profile) => setFamilyId(profile.family.family_id))
      .catch(() => {
        toast.error('Unable to load your profile. Payment settings may not work correctly.');
      });
  }, []);

  const handleSetupComplete = () => {
    setShowSetup(false);
    setRefreshKey((prev) => prev + 1);
  };

  const handleSetupClick = () => {
    setShowSetup(true);
  };

  const handleCancelSetup = () => {
    setShowSetup(false);
  };

  const filteredInvoices =
    filterStatus === 'all'
      ? invoices
      : invoices.filter((inv) => getDisplayStatus(inv) === filterStatus);

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-5xl sm:text-6xl text-dark-primary tracking-tight mb-2">
              Payments & Invoices
            </h1>
            <p className="text-dark-primary/60 text-lg">
              Manage your invoices and payment settings
            </p>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`min-h-[44px] px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'invoices'
                  ? 'bg-brand text-dark-primary shadow-sm'
                  : 'bg-dark-primary/80 text-text-secondary hover:bg-dark-primary'
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`min-h-[44px] px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'settings'
                  ? 'bg-brand text-dark-primary shadow-sm'
                  : 'bg-dark-primary/80 text-text-secondary hover:bg-dark-primary'
              }`}
            >
              Payment Settings
            </button>
          </div>

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <>
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`min-h-[44px] px-4 py-2 rounded-lg font-semibold text-sm ${
                    filterStatus === 'all'
                      ? 'bg-brand text-dark-primary'
                      : 'bg-dark-primary/80 text-text-secondary hover:bg-dark-primary'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus(InvoiceStatus.DRAFT)}
                  className={`min-h-[44px] px-4 py-2 rounded-lg font-semibold text-sm ${
                    filterStatus === InvoiceStatus.DRAFT
                      ? 'bg-brand text-dark-primary'
                      : 'bg-dark-primary/80 text-text-secondary hover:bg-dark-primary'
                  }`}
                >
                  Draft
                </button>
                <button
                  onClick={() => setFilterStatus(InvoiceStatus.SENT)}
                  className={`min-h-[44px] px-4 py-2 rounded-lg font-semibold text-sm ${
                    filterStatus === InvoiceStatus.SENT
                      ? 'bg-brand text-dark-primary'
                      : 'bg-dark-primary/80 text-text-secondary hover:bg-dark-primary'
                  }`}
                >
                  Sent
                </button>
                <button
                  onClick={() => setFilterStatus(InvoiceStatus.PAID)}
                  className={`min-h-[44px] px-4 py-2 rounded-lg font-semibold text-sm ${
                    filterStatus === InvoiceStatus.PAID
                      ? 'bg-brand text-dark-primary'
                      : 'bg-dark-primary/80 text-text-secondary hover:bg-dark-primary'
                  }`}
                >
                  Paid
                </button>
                <button
                  onClick={() => setFilterStatus(InvoiceStatus.OVERDUE)}
                  className={`min-h-[44px] px-4 py-2 rounded-lg font-semibold text-sm ${
                    filterStatus === InvoiceStatus.OVERDUE
                      ? 'bg-brand text-dark-primary'
                      : 'bg-dark-primary/80 text-text-secondary hover:bg-dark-primary'
                  }`}
                >
                  Overdue
                </button>
              </div>

              {/* Loading State */}
              {loading && <LoadingSpinner message="Loading invoices..." size="md" />}

              {/* Error State */}
              {error && !loading && <ErrorState message={error} onRetry={loadInvoices} />}

              {/* Invoices List */}
              {!loading && !error && (
                <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 p-6">
                  {filteredInvoices.length === 0 ? (
                    <EmptyState
                      icon={CreditCard}
                      title="No payments yet"
                      description="Payment records will appear here."
                      actionLabel="View Billing"
                      actionHref="/billing"
                    />
                  ) : (
                    <div className="space-y-4">
                      {filteredInvoices.map((invoice) => (
                        <div
                          key={invoice.invoice_id}
                          onClick={() => router.push(`/billing/${invoice.invoice_id}`)}
                          className="flex items-center justify-between p-6 bg-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group min-h-[44px]"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-xl text-white truncate">
                                {invoice.family?.family_name || 'Unknown Family'}
                              </h3>
                              <InvoiceStatusBadge status={getDisplayStatus(invoice)} />
                            </div>
                            <p className="text-sm text-text-secondary mb-1">
                              Amount:{' '}
                              <span className="font-semibold text-white tabular-nums">
                                {formatCurrency(invoice.total_amount, invoice.currency)}
                              </span>
                            </p>
                            <p className="text-sm text-text-secondary tabular-nums">
                              Due {formatDate(invoice.due_date)} &middot; Created{' '}
                              {formatDate(invoice.created_at)}
                            </p>
                            {invoice.items && invoice.items.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-text-secondary">
                                  {invoice.items.length} item{invoice.items.length > 1 ? 's' : ''}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-text-tertiary group-hover:bg-brand group-hover:text-dark-primary rounded-lg transition-all flex-shrink-0 ml-2">
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M9 5l7 7-7 7"></path>
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Payment Settings Tab: informational state while the club has no
              payment connection, otherwise the provider-specific setup flow. */}
          {activeTab === 'settings' && paymentsNotSetUp && (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 p-6">
              <h2 className="font-serif text-2xl text-white mb-4">
                Online payments are not available yet
              </h2>
              <p className="text-text-secondary text-sm">
                Your club has not set up online payments yet. You will be able to add a payment
                method here once they have. Contact the club if you have questions.
              </p>
            </div>
          )}
          {activeTab === 'settings' && !paymentsNotSetUp && (
            <>
              {/* Info Section */}
              <div className="bg-brand/10 border border-brand/40 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-4">
                  <svg
                    className="w-6 h-6 text-brand flex-shrink-0 mt-1"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <h3 className="text-dark-primary font-semibold mb-2">
                      About {settingsHeading}
                    </h3>
                    <p className="text-text-secondary text-sm">
                      {isStripe
                        ? 'Set up automatic payments for your monthly swim club fees. You will be taken to a secure Stripe page to set up your payment method. Depending on your club, you can pay by bank debit or card. You can cancel at any time.'
                        : isBacs
                          ? 'Set up Direct Debit to automatically pay your monthly swim club fees. Direct Debit is protected by the Direct Debit Guarantee, making it a safe and convenient way to pay. You can cancel at any time.'
                          : isBecs
                            ? 'Set up Direct Debit to automatically pay your monthly swim club fees. You will be asked to complete a Direct Debit Request, and your payments are protected under the Bulk Electronic Clearing System (BECS) rules and the Direct Debit Request Service Agreement. You can cancel at any time.'
                            : `Set up ${methodLabel} to automatically pay your monthly swim club fees. Your payments are protected by your country's bank debit scheme rules. You can cancel at any time.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Debit Management */}
              <div className="space-y-6">
                {showSetup ? (
                  <MandateSetup
                    familyId={familyId}
                    onComplete={handleSetupComplete}
                    onCancel={handleCancelSetup}
                  />
                ) : (
                  <MandateStatus
                    key={refreshKey}
                    familyId={familyId}
                    onSetupClick={handleSetupClick}
                  />
                )}
              </div>

              {/* Additional Payment Information */}
              <div className="mt-8 bg-dark-primary rounded-3xl shadow-lg border border-white/10 p-6">
                <h2 className="font-serif text-2xl text-white mb-4">Payment Information</h2>
                <div className="space-y-4 text-sm text-text-secondary">
                  <div>
                    <h3 className="text-white font-medium mb-2">
                      How {settingsHeading} work{isStripe ? '' : 's'}
                    </h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Monthly fees are automatically collected on the 1st of each month</li>
                      <li>You&apos;ll receive notification before each payment is taken</li>
                      {!isStripe && (
                        <li>Payments are taken {settlementTiming} after the collection date</li>
                      )}
                      <li>You can cancel or pause at any time through this page</li>
                    </ul>
                  </div>
                  <div>
                    {isStripe ? (
                      <>
                        <h3 className="text-white font-medium mb-2">Payment protection</h3>
                        <p>
                          Protected by your card scheme or bank debit scheme rules. Payments are
                          processed securely through Stripe. You can cancel at any time.
                        </p>
                      </>
                    ) : isBacs ? (
                      <>
                        <h3 className="text-white font-medium mb-2">Direct Debit Guarantee</h3>
                        <p>
                          The Direct Debit Guarantee protects you against incorrect payments. If an
                          error is made by us or your bank, you are entitled to a full and immediate
                          refund from your bank.
                        </p>
                      </>
                    ) : isBecs ? (
                      <>
                        <h3 className="text-white font-medium mb-2">
                          Direct Debit Request Service Agreement
                        </h3>
                        <p>
                          Your Direct Debit Request is governed by the Bulk Electronic Clearing
                          System (BECS) rules and the Direct Debit Request Service Agreement. If a
                          payment is taken in error, you are entitled to a refund from your bank.
                          You can cancel at any time.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-white font-medium mb-2">Payment protection</h3>
                        <p>
                          Your payments are protected by your country&apos;s bank debit scheme
                          rules. You can cancel at any time.
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-2">Alternative payment methods</h3>
                    <p>
                      If you prefer not to use {settingsHeading}, you can pay invoices manually via
                      bank transfer. Please contact the club administrator for bank details.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
