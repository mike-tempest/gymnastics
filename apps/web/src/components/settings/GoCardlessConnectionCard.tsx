'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  completeGoCardlessConnect,
  disconnectGoCardlessConnection,
  getGoCardlessConnection,
  reconcileGoCardlessMandates,
  startGoCardlessConnect,
  syncGoCardlessConnection,
  type MandateReconciliation,
} from '@/lib/api/payments-connection';
import { redirectTo } from '@/lib/utils/browser-navigation';

const KEY = ['admin', 'payments', 'gocardless'];
const BUTTON =
  'min-h-[48px] px-4 py-3 rounded-button bg-white/10 border border-white/20 text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand';

export function GoCardlessConnectionCard() {
  const client = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: getGoCardlessConnection,
    retry: false,
  });
  const handled = useRef(false);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [reconciliation, setReconciliation] = useState<MandateReconciliation | null>(null);
  useEffect(() => {
    if (handled.current) return;
    const url = new URL(window.location.href);
    const state = url.searchParams.get('state');
    if (!state) return;
    handled.current = true;
    const code = url.searchParams.get('code');
    for (const key of ['state', 'code', 'error', 'error_description']) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, '', url.toString());
    if (!code) {
      toast.error('GoCardless connection was not completed. You can try again.');
      return;
    }
    setBusy(true);
    completeGoCardlessConnect(code, state)
      .then(async (connection) => {
        await client.cancelQueries({ queryKey: KEY });
        client.setQueryData(KEY, connection);
        await client.invalidateQueries({ queryKey: ['admin', 'payments', 'connection'] });
        toast.success('GoCardless authorisation saved. Check the connection status below.');
      })
      .catch(() =>
        toast.error('Could not complete GoCardless setup. Start a new connection attempt.')
      )
      .finally(() => setBusy(false));
  }, [client]);

  async function action(kind: 'connect' | 'sync' | 'disconnect' | 'reconcile') {
    setBusy(true);
    try {
      if (kind === 'connect') {
        redirectTo((await startGoCardlessConnect()).url);
        return;
      }
      if (kind === 'reconcile') {
        setReconciliation(await reconcileGoCardlessMandates());
        return;
      }
      const connection =
        kind === 'sync' ? await syncGoCardlessConnection() : await disconnectGoCardlessConnection();
      client.setQueryData(KEY, connection);
      await client.invalidateQueries({ queryKey: ['admin', 'payments', 'connection'] });
      setConfirmDisconnect(false);
      setReconciliation(null);
    } catch {
      toast.error(
        'GoCardless action could not be completed. Check your account setup and try again.'
      );
    } finally {
      setBusy(false);
    }
  }
  if (isLoading) return <p role="status">Loading Direct Debit connection...</p>;
  if (isError || !data)
    return (
      <div role="alert">
        <p>Could not check the Direct Debit connection.</p>
        <button className={BUTTON} onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  const linked = data.status !== 'none' && data.status !== 'disconnected';
  return (
    <section className="space-y-4" aria-label="GoCardless Direct Debit">
      <h3 className="font-semibold text-white">Direct Debit with GoCardless</h3>
      <p className="text-sm text-white/70">
        Connect your club’s own account so collections go directly to your club.
      </p>
      {!data.configured && (
        <p role="status">GoCardless connection setup is not yet enabled. Please contact support.</p>
      )}
      {data.status !== 'none' && (
        <p role="status">
          {data.status === 'active'
            ? 'Connected'
            : data.status === 'pending'
              ? 'Verification incomplete'
              : data.status === 'restricted'
                ? 'Account restricted'
                : 'Disconnected'}
          {data.external_account_id ? ` (${data.external_account_id})` : ''}
        </p>
      )}
      {data.livemode === false && (
        <p className="text-warning">Sandbox connection. Payments do not move real money.</p>
      )}
      {data.capabilities?.requirements_due?.map((item) => (
        <p key={item} className="text-warning">
          {item}
        </p>
      ))}
      {linked && (
        <a
          className="inline-flex min-h-[48px] items-center text-brand underline"
          href={
            data.livemode
              ? 'https://manage.gocardless.com'
              : 'https://manage-sandbox.gocardless.com'
          }
          target="_blank"
          rel="noreferrer"
        >
          Manage verification in GoCardless
        </a>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          className={BUTTON}
          disabled={busy || !data.configured}
          onClick={() => action('connect')}
        >
          {linked ? 'Reconnect GoCardless' : 'Connect with GoCardless'}
        </button>
        {linked && (
          <>
            <button
              className={BUTTON}
              disabled={busy || !data.configured}
              onClick={() => action('sync')}
            >
              Refresh Direct Debit status
            </button>
            <button
              className={BUTTON}
              disabled={busy || !data.configured}
              onClick={() => action('reconcile')}
            >
              Check imported mandates
            </button>
            <button className={BUTTON} disabled={busy} onClick={() => setConfirmDisconnect(true)}>
              Disconnect GoCardless
            </button>
          </>
        )}
      </div>
      {confirmDisconnect && (
        <div className="space-y-3 border border-warning p-4 rounded-button">
          <p>
            Disconnecting stops new collections through this app. Existing payments and mandates
            remain with GoCardless. Automatic payment updates pause until you reconnect. Review any
            outstanding payments first. Revoke the app’s access in your GoCardless dashboard too.
          </p>
          <button className={BUTTON} disabled={busy} onClick={() => action('disconnect')}>
            Confirm disconnection
          </button>{' '}
          <button className={BUTTON} disabled={busy} onClick={() => setConfirmDisconnect(false)}>
            Keep connected
          </button>
        </div>
      )}
      {reconciliation && (
        <div role="status" className="text-sm space-y-2">
          <p>
            {reconciliation.results.filter((r) => r.status === 'verified').length} of{' '}
            {reconciliation.results.length} mandates verified in this account.
          </p>
          {reconciliation.results
            .filter((r) => r.status !== 'verified')
            .map((r) => (
              <p key={r.mandate_id}>
                {r.provider_mandate_id}:{' '}
                {r.status === 'not_in_account'
                  ? 'Not found in this account. Check the source export.'
                  : 'Could not verify. Try again before collecting.'}
              </p>
            ))}
          <p>Original mandate references are retained. Each collection checks access again.</p>
        </div>
      )}
    </section>
  );
}
