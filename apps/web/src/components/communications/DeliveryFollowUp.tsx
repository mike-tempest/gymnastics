'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { api } from '@/lib/api/api-client';

interface Delivery {
  delivery_id: string;
  recipient_name: string;
  status: 'queued' | 'sending' | 'provider_accepted' | 'delivered' | 'failed' | 'suppressed';
  last_error: string | null;
  follow_up_note: string | null;
  retryable: boolean;
}
const noteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, 'Enter a follow-up note')
    .max(1000, 'Use at most 1,000 characters'),
});
function FollowUpForm({
  row,
  busy,
  save,
}: {
  row: Delivery;
  busy: boolean;
  save: (note: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof noteSchema>>({ resolver: zodResolver(noteSchema) });
  return (
    <form className="mt-3" onSubmit={handleSubmit(({ note }) => save(note))}>
      <label className="block text-sm" htmlFor={`follow-up-${row.delivery_id}`}>
        Record manual follow-up for {row.recipient_name}
      </label>
      <textarea
        id={`follow-up-${row.delivery_id}`}
        maxLength={1000}
        {...register('note')}
        aria-invalid={!!errors.note}
        aria-describedby={errors.note ? `note-error-${row.delivery_id}` : undefined}
        className="mt-1 min-h-[48px] w-full rounded-lg border border-grey-400 p-3"
      />
      {errors.note && (
        <p role="alert" id={`note-error-${row.delivery_id}`}>
          {errors.note.message}
        </p>
      )}
      <button
        disabled={busy}
        className="min-h-[48px] rounded-lg bg-dark-primary px-4 text-white disabled:opacity-50"
        type="submit"
      >
        Save follow-up
      </button>
    </form>
  );
}
const labels: Record<Delivery['status'], string> = {
  queued: 'Queued',
  sending: 'Sending',
  provider_accepted: 'Accepted by email provider',
  delivered: 'Delivered to recipient server',
  failed: 'Failed',
  suppressed: 'Suppressed',
};
export default function DeliveryFollowUp({
  source,
  sourceId,
}: {
  source: 'broadcast' | 'session_cancellation';
  sourceId: string;
}) {
  const { data: session } = useSession();
  const role = session?.user.role?.toLowerCase();
  const allowed =
    !!role &&
    (source === 'broadcast'
      ? ['super_admin', 'head_coach']
      : ['super_admin', 'head_coach', 'squad_coach']
    ).includes(role);
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const key = [
    'delivery-follow-up',
    session?.user.id,
    session?.user.role,
    session?.user.clubId,
    source,
    sourceId,
    page,
  ];
  const query = useQuery<Delivery[]>({
    queryKey: key,
    queryFn: () =>
      api.get(`/notification-deliveries?source_type=${source}&source_id=${sourceId}&page=${page}`),
    enabled: allowed,
    refetchInterval: 15000,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!allowed) return null;
  async function act(row: Delivery, retry: boolean, note?: string) {
    setBusy(row.delivery_id);
    setError(null);
    try {
      if (retry) await api.post(`/notification-deliveries/${row.delivery_id}/retry`, {});
      else
        await api.patch(`/notification-deliveries/${row.delivery_id}/follow-up`, {
          note,
        });
      await client.invalidateQueries({ queryKey: key });
    } catch {
      setError('Could not save this action. Please try again.');
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      className="ph-no-capture mt-6 rounded-2xl border border-grey-300 bg-white p-6 text-text-primary"
      aria-label="Email delivery follow-up"
    >
      <h2 className="text-xl font-semibold">Email delivery follow-up</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Provider acceptance means the email was queued for delivery. Delivery confirms the recipient
        server accepted it, not that someone read it.
      </p>
      {query.isLoading && <p role="status">Loading deliveries...</p>}
      {query.isError && (
        <div role="alert">
          Could not load deliveries.{' '}
          <button className="min-h-[48px] px-3 underline" onClick={() => query.refetch()}>
            Retry loading
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {query.data?.length === 0 && (
        <p className="mt-4">
          No delivery records. Older messages sent before delivery tracking are not included.
        </p>
      )}
      <ul className="mt-4 space-y-4">
        {query.data?.slice(0, 100).map((row) => (
          <li key={row.delivery_id} className="rounded-xl border border-grey-300 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold">{row.recipient_name}</h3>
              <span>{labels[row.status]}</span>
            </div>
            {row.last_error && <p className="mt-2 text-sm">{row.last_error}</p>}
            {row.follow_up_note && <p className="mt-2 text-sm">Follow-up: {row.follow_up_note}</p>}
            {row.retryable && (
              <button
                disabled={busy === row.delivery_id}
                className="mt-2 min-h-[48px] rounded-lg border border-grey-400 px-4 disabled:opacity-50"
                onClick={() => act(row, true)}
              >
                Retry email
              </button>
            )}
            {['failed', 'suppressed'].includes(row.status) && (
              <FollowUpForm
                row={row}
                busy={busy === row.delivery_id}
                save={(note) => act(row, false, note)}
              />
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-4">
        <button
          className="min-h-[48px] px-4 disabled:opacity-50"
          disabled={page === 0 || query.isFetching}
          onClick={() => setPage(page - 1)}
        >
          Previous recipients
        </button>
        <button
          className="min-h-[48px] px-4 disabled:opacity-50"
          disabled={!query.data || query.data.length <= 100 || query.isFetching}
          onClick={() => setPage(page + 1)}
        >
          More recipients
        </button>
      </div>
    </section>
  );
}
