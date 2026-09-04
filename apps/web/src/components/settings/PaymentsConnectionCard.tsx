'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  getPaymentConnection,
  startStripeConnect,
  syncStripeConnection,
  type PaymentConnection,
  type PaymentConnectionStatus,
} from '@/lib/api/payments-connection';
import { redirectTo } from '@/lib/utils/browser-navigation';

const PRIMARY_BUTTON =
  'inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-button font-semibold bg-brand text-dark-primary hover:bg-brand-dark transition-colors disabled:opacity-50';
const SECONDARY_BUTTON =
  'inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-button font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50';

const CONNECTION_QUERY_KEY = ['admin', 'payments', 'connection'];

/** How many outstanding requirements to list before collapsing the rest. */
const MAX_REQUIREMENTS_SHOWN = 4;

/** Masks a Stripe account id down to its prefix and last four characters. */
function maskAccountId(accountId: string): string {
  return `acct_...${accountId.slice(-4)}`;
}

function badgeForStatus(status: PaymentConnectionStatus) {
  switch (status) {
    case 'active':
      return { label: 'Connected', className: 'bg-success/15 text-success border border-success/40' };
    case 'pending':
      return { label: 'Setup incomplete', className: 'bg-warning/15 text-warning border border-warning/40' };
    case 'restricted':
      return { label: 'Restricted', className: 'bg-danger/15 text-danger border border-danger/40' };
    case 'disconnected':
      return { label: 'Disconnected', className: 'bg-danger/15 text-danger border border-danger/40' };
    default:
      return null;
  }
}

function toastSyncResult(connection: PaymentConnection) {
  switch (connection.status) {
    case 'active':
      toast.success('Stripe connection is active');
      break;
    case 'pending':
      toast.info('Stripe setup is not complete yet');
      break;
    case 'restricted':
      toast.error('Your Stripe account is restricted. Continue setup with Stripe to resolve it.');
      break;
    case 'disconnected':
      toast.error('Your Stripe account is disconnected. Continue setup with Stripe to reconnect.');
      break;
    default:
      toast.info('No Stripe account is connected yet');
  }
}

/**
 * Removes the one-shot ?stripe=return / ?stripe=refresh flag Stripe appends
 * to the redirect back from hosted onboarding, without a navigation.
 */
function cleanStripeQueryParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete('stripe');
  window.history.replaceState(window.history.state, '', url.toString());
}

/**
 * Body of the Payment Settings card on the admin settings page. Clubs connect
 * their own Stripe account through Stripe-hosted onboarding, so parent
 * payments settle directly with the club. All the connection state lives on
 * the backend; this card only reads it and redirects to Stripe-hosted pages.
 */
export function PaymentsConnectionCard() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const autoSynced = useRef(false);

  const {
    data: connection,
    isLoading,
    isError,
  } = useQuery({
    queryKey: CONNECTION_QUERY_KEY,
    queryFn: getPaymentConnection,
    retry: false,
  });

  // Returning from Stripe-hosted onboarding lands back here with
  // ?stripe=return (finished) or ?stripe=refresh (link expired). Either way
  // the truth lives with Stripe, so sync once, clean the flag and toast.
  useEffect(() => {
    if (autoSynced.current) return;
    const stripeParam = new URLSearchParams(window.location.search).get('stripe');
    if (stripeParam !== 'return' && stripeParam !== 'refresh') return;
    autoSynced.current = true;
    cleanStripeQueryParam();
    syncStripeConnection()
      .then(async (updated) => {
        // Cancel the initial GET so a slower response cannot overwrite the
        // fresher synced payload.
        await queryClient.cancelQueries({ queryKey: CONNECTION_QUERY_KEY });
        queryClient.setQueryData(CONNECTION_QUERY_KEY, updated);
        toastSyncResult(updated);
      })
      .catch(() => {
        toast.error('Could not refresh your Stripe connection status. Please try Refresh status.');
      });
  }, [queryClient]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const { url } = await startStripeConnect();
      redirectTo(url);
    } catch {
      setConnecting(false);
      toast.error('Could not start Stripe setup. Please try again.');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const updated = await syncStripeConnection();
      queryClient.setQueryData(CONNECTION_QUERY_KEY, updated);
      toastSyncResult(updated);
    } catch {
      toast.error('Could not refresh your Stripe connection status. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-white/60 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading payment connection...
      </div>
    );
  }

  // An error usually means the backend predates the payments endpoints, which
  // is the same situation for the club as an unconfigured environment.
  if (isError || !connection || !connection.configured) {
    return (
      <p className="text-white/60 text-sm">
        Online payments are not yet enabled on this Swimly environment.
      </p>
    );
  }

  const badge = badgeForStatus(connection.status);
  const requirementsDue = connection.capabilities?.requirements_due ?? [];
  const shownRequirements = requirementsDue.slice(0, MAX_REQUIREMENTS_SHOWN);
  const hiddenRequirementCount = requirementsDue.length - shownRequirements.length;

  const connectButton = (label: string) => (
    <button type="button" onClick={handleConnect} disabled={connecting} className={PRIMARY_BUTTON}>
      {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
      {label}
    </button>
  );

  const refreshButton = (
    <button type="button" onClick={handleSync} disabled={syncing} className={SECONDARY_BUTTON}>
      {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      Refresh status
    </button>
  );

  return (
    <div className="space-y-4">
      {badge && (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      )}

      {connection.status === 'none' && (
        <>
          <p className="text-white/60 text-sm">
            Connect your club&apos;s own Stripe account and payments from parents go directly to
            the club, with support for card and bank debit payments.
          </p>
          {connectButton('Connect with Stripe')}
        </>
      )}

      {connection.status === 'pending' && (
        <>
          <p className="text-white/60 text-sm">
            Stripe still needs some information before your club can take payments.
          </p>
          {requirementsDue.length > 0 && (
            <ul className="list-disc list-inside space-y-1 text-sm text-white/60">
              {shownRequirements.map((requirement) => (
                <li key={requirement} className="break-all">
                  {requirement}
                </li>
              ))}
              {hiddenRequirementCount > 0 && (
                <li>
                  and {hiddenRequirementCount} more requirement{hiddenRequirementCount > 1 ? 's' : ''}
                </li>
              )}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            {connectButton('Continue setup with Stripe')}
            {refreshButton}
          </div>
        </>
      )}

      {connection.status === 'active' && (
        <>
          {connection.livemode === false && (
            <div className="flex items-start gap-3 p-4 rounded-button bg-warning/15 border border-warning/40">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-warning text-sm font-semibold">
                This is a Stripe TEST account - payments will not move real money.
              </p>
            </div>
          )}
          {connection.external_account_id && (
            <p className="text-white/60 text-sm">
              Stripe account{' '}
              <span className="text-white font-medium tabular-nums">
                {maskAccountId(connection.external_account_id)}
              </span>
            </p>
          )}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-5 h-5 ${connection.capabilities?.charges_enabled ? 'text-success' : 'text-white/30'}`}
              />
              <span className="text-white/80">
                {connection.capabilities?.charges_enabled ? 'Payments enabled' : 'Payments not yet enabled'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-5 h-5 ${connection.capabilities?.payouts_enabled ? 'text-success' : 'text-white/30'}`}
              />
              <span className="text-white/80">
                {connection.capabilities?.payouts_enabled ? 'Payouts enabled' : 'Payouts not yet enabled'}
              </span>
            </div>
          </div>
          {refreshButton}
        </>
      )}

      {(connection.status === 'restricted' || connection.status === 'disconnected') && (
        <>
          <p className="text-white/60 text-sm">
            {connection.status === 'restricted'
              ? 'Stripe has restricted this account, so payments may fail until the outstanding requirements are resolved.'
              : 'This Stripe account is no longer connected, so payments cannot be taken.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {connectButton('Continue setup with Stripe')}
            {refreshButton}
          </div>
        </>
      )}

      <p className="text-white/40 text-sm">
        Direct Debit via your own GoCardless account is coming soon.
      </p>
    </div>
  );
}
