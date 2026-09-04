'use client';

import { useQuery } from '@tanstack/react-query';
import { CreditCard, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { getPaymentConnection } from '@/lib/api/payments-connection';

/**
 * Matches PaymentsConnectionCard's key so both surfaces share one cached read
 * of GET /admin/settings/payments/connection.
 */
const CONNECTION_QUERY_KEY = ['admin', 'payments', 'connection'];

/** Session-scoped dismissal: the nudge returns next visit, not next render. */
const DISMISS_STORAGE_KEY = 'swimly-connect-payments-banner-dismissed';

function initiallyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
}

/**
 * Gentle admin nudge shown on billing surfaces while the club has no active
 * payment connection. Purely informational: manual invoicing keeps working
 * without a connection, so this never blocks anything, and it stays hidden
 * while the connection state is loading, on error, or when the platform has
 * no Stripe configuration at all (nothing to connect to).
 */
export default function ConnectPaymentsBanner() {
  const [dismissed, setDismissed] = useState(initiallyDismissed);

  const { data: connection } = useQuery({
    queryKey: CONNECTION_QUERY_KEY,
    queryFn: getPaymentConnection,
    retry: false,
  });

  if (dismissed || !connection || !connection.configured || connection.status === 'active') {
    return null;
  }

  const handleDismiss = () => {
    window.sessionStorage.setItem(DISMISS_STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="mb-6 p-4 bg-brand/10 border border-brand/40 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start sm:items-center gap-3 flex-1">
        <CreditCard className="w-5 h-5 text-brand flex-shrink-0" aria-hidden="true" />
        <p className="text-dark-primary text-sm">
          Connect your club&apos;s Stripe account to collect payments automatically.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/admin/settings#payments"
          className="px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-xl text-sm font-semibold bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 transition-all"
        >
          Go to payment settings
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-dark-primary/50 hover:text-dark-primary hover:bg-dark-primary/5 transition-all"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
