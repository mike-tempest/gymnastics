'use client';

import { ALL_API_KEY_SCOPES, ApiKeyScope } from '@club-manager/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { createApiKey, listApiKeys, revokeApiKey, type ApiKeySummary } from '@/lib/api/api-keys';
import { MEMBER_NOUN_PLURAL } from '@/lib/brand';

const PRIMARY_BUTTON =
  'inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-button font-semibold bg-brand text-dark-primary hover:bg-brand-dark transition-colors disabled:opacity-50';
const SECONDARY_BUTTON =
  'inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-button font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50';
const DANGER_BUTTON =
  'inline-flex items-center gap-2 px-4 py-2 min-h-[48px] rounded-button font-medium text-danger border border-danger/40 hover:bg-danger/10 transition-colors disabled:opacity-50';
const FIELD_LABEL = 'block text-sm font-medium text-white/70 mb-2';
const FIELD_INPUT =
  'w-full px-4 py-3 min-h-[48px] rounded-button bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

const API_KEYS_QUERY_KEY = ['admin', 'settings', 'api-keys'];

/**
 * Human labels for each read scope. The gymnast label comes from the brand
 * constants rather than being written out, so a future sport is still a
 * one-line change.
 */
const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  [ApiKeyScope.MEMBERS_READ]: MEMBER_NOUN_PLURAL,
  [ApiKeyScope.FAMILIES_READ]: 'Families',
  [ApiKeyScope.SQUADS_READ]: 'Squads',
  [ApiKeyScope.SESSIONS_READ]: 'Sessions',
  [ApiKeyScope.ATTENDANCE_READ]: 'Attendance',
  [ApiKeyScope.INVOICES_READ]: 'Invoices',
  [ApiKeyScope.MANDATES_READ]: 'Direct Debit mandates',
  [ApiKeyScope.AWARDS_READ]: 'Awards and badges',
};

/** Day/short-month/year, matching the rest of the admin surfaces. */
function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The one-time reveal of a newly created credential.
 *
 * It is shown in a panel of its own, with the warning above the value rather
 * than below it, because by the time an admin has scrolled past the secret
 * they have already decided whether to copy it.
 */
function NewKeyReveal({
  plaintextKey,
  onDismiss,
}: {
  plaintextKey: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plaintextKey);
      setCopied(true);
      toast.success('Key copied to your clipboard');
    } catch {
      toast.error('Could not copy the key. Select it and copy manually.');
    }
  };

  return (
    <div className="mb-6 rounded-card border border-warning/40 bg-warning/10 p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-white">Copy this key now</p>
          <p className="text-sm text-white/70">
            This is the only time it will be shown. We store a one-way hash of it, so we cannot show
            it to you again. If you lose it, revoke the key and create another.
          </p>
        </div>
      </div>

      <code className="block w-full break-all rounded-button bg-dark-primary/60 border border-white/20 px-4 py-3 font-mono text-sm text-white">
        {plaintextKey}
      </code>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={handleCopy} className={PRIMARY_BUTTON}>
          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          {copied ? 'Copied' : 'Copy key'}
        </button>
        <button type="button" onClick={onDismiss} className={SECONDARY_BUTTON}>
          I have saved it
        </button>
      </div>
    </div>
  );
}

/** One row of the key list. */
function ApiKeyRow({
  apiKey,
  onRevoke,
  revoking,
}: {
  apiKey: ApiKeySummary;
  onRevoke: (apiKey: ApiKeySummary) => void;
  revoking: boolean;
}) {
  const isRevoked = Boolean(apiKey.revoked_at);

  return (
    <li className="flex flex-col gap-3 rounded-card border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">{apiKey.label}</span>
          {isRevoked ? (
            <span className="rounded-full border border-danger/40 bg-danger/15 px-2 py-0.5 text-xs text-danger">
              Revoked {formatDate(apiKey.revoked_at)}
            </span>
          ) : (
            <span className="rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-xs text-success">
              Active
            </span>
          )}
        </div>
        <p className="mt-1 break-all font-mono text-sm text-white/60">{apiKey.key_prefix}</p>
        <p className="mt-1 text-sm text-white/50">
          Last used {formatDate(apiKey.last_used_at)}. Created {formatDate(apiKey.created_at)}.
        </p>
        <p className="mt-1 text-sm text-white/50">
          Can read: {apiKey.scopes.map((scope) => SCOPE_LABELS[scope] ?? scope).join(', ')}
        </p>
      </div>

      {!isRevoked && (
        <button
          type="button"
          onClick={() => onRevoke(apiKey)}
          disabled={revoking}
          className={DANGER_BUTTON}
        >
          {revoking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          Revoke
        </button>
      )}
    </li>
  );
}

/**
 * Body of the API Access card on the admin settings page (TEM-32).
 *
 * A club owns its data and can read it out through a key it controls. Three
 * things this deliberately does not do: it never displays a key after
 * creation, it never sends a key anywhere other than the clipboard, and it
 * revokes rather than deletes so the club keeps a record of what once had
 * access.
 */
export function ApiKeysCard() {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>([...ALL_API_KEY_SCOPES]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const {
    data: apiKeys,
    isLoading,
    isError,
  } = useQuery({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: listApiKeys,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: async (response) => {
      setNewKey(response.plaintext_key);
      setLabel('');
      await queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
    onError: () => {
      toast.error('Could not create the key. Please try again.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      toast.success('Key revoked. It stops working immediately.');
      await queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
    onError: () => {
      toast.error('Could not revoke the key. Please try again.');
    },
    onSettled: () => {
      setRevokingId(null);
    },
  });

  const toggleScope = (scope: ApiKeyScope) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]
    );
  };

  const handleCreate = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error('Give the key a name so you can recognise it later.');
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error('Choose at least one thing the key can read.');
      return;
    }
    createMutation.mutate({ label: trimmed, scopes: selectedScopes });
  };

  const handleRevoke = (apiKey: ApiKeySummary) => {
    // A revoked key cannot be restored, so this asks before acting.
    const confirmed = window.confirm(
      `Revoke "${apiKey.label}"? Anything using this key stops working straight away. This cannot be undone.`
    );
    if (!confirmed) return;
    setRevokingId(apiKey.api_key_id);
    revokeMutation.mutate(apiKey.api_key_id);
  };

  return (
    <div>
      <p className="text-white/60 mb-6">
        Read your club data from your own scripts and tools. Keys are read only, so nothing using
        one can change your records, and each key only ever sees this club.
      </p>

      {/* Keyed on the credential so a second key remounts the panel. Without
          that, the "Copied" state from the previous key would persist and an
          admin could dismiss a key they had never actually copied, losing a
          credential that by design cannot be shown again. */}
      {newKey && (
        <NewKeyReveal key={newKey} plaintextKey={newKey} onDismiss={() => setNewKey(null)} />
      )}

      <div className="mb-8 rounded-card border border-white/10 bg-white/5 p-4 sm:p-6">
        <h3 className="mb-4 font-semibold text-white">Create a key</h3>

        <div className="mb-4">
          <label htmlFor="api-key-label" className={FIELD_LABEL}>
            Name
          </label>
          <input
            id="api-key-label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={120}
            placeholder="Finance reporting script"
            className={FIELD_INPUT}
          />
        </div>

        <fieldset className="mb-4">
          <legend className={FIELD_LABEL}>What this key can read</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_API_KEY_SCOPES.map((scope) => (
              <label
                key={scope}
                className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-button border border-white/20 bg-white/5 px-4 py-2 text-white hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                  className="h-5 w-5 rounded border-white/30 bg-white/10 text-brand focus:ring-brand"
                />
                <span className="text-sm">{SCOPE_LABELS[scope]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className={PRIMARY_BUTTON}
        >
          {createMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          Create key
        </button>
      </div>

      <h3 className="mb-4 font-semibold text-white">Your keys</h3>

      {isLoading && (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading keys
        </div>
      )}

      {isError && (
        <p className="text-danger">Could not load your keys. Refresh the page to try again.</p>
      )}

      {!isLoading && !isError && (apiKeys?.length ?? 0) === 0 && (
        <div className="flex items-center gap-3 rounded-card border border-white/10 bg-white/5 p-4 text-white/60">
          <KeyRound className="w-5 h-5" />
          You have not created any keys yet.
        </div>
      )}

      {!isLoading && !isError && (apiKeys?.length ?? 0) > 0 && (
        <ul className="flex flex-col gap-3">
          {apiKeys?.map((apiKey) => (
            <ApiKeyRow
              key={apiKey.api_key_id}
              apiKey={apiKey}
              onRevoke={handleRevoke}
              revoking={revokingId === apiKey.api_key_id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
