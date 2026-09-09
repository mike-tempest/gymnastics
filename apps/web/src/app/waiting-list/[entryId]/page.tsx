'use client';

import {
  DISCIPLINE_LABELS,
  SQUAD_TYPE_LABELS,
  WAITING_LIST_OFFER_STATUS_LABELS,
  WAITING_LIST_STATUS_LABELS,
} from '@club-manager/shared-types';
import { useCallback, useEffect, useState } from 'react';

import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { getWaitingListEntry, type WaitingListEntryDetail } from '@/lib/api/waiting-list';
import { MEMBER_NOUN_LOWER } from '@/lib/brand';

/** What the family asked for, in words, or that they are open to anything. */
function describeWants(entry: WaitingListEntryDetail): string {
  const parts = [
    entry.desired_squad_type ? SQUAD_TYPE_LABELS[entry.desired_squad_type] : null,
    entry.desired_discipline ? DISCIPLINE_LABELS[entry.desired_discipline] : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Any class with a free place';
}

/**
 * One child on the waiting list (TEM-22): who they are, what they asked for,
 * why they sit where they sit, and every offer they have been made.
 */
export default function WaitingListEntryPage({ params }: { params: { entryId: string } }) {
  const { formatDate } = useFormatters();
  const [entry, setEntry] = useState<WaitingListEntryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntry = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setEntry(await getWaitingListEntry(params.entryId));
    } catch {
      setError('Could not load this waiting list entry.');
    } finally {
      setIsLoading(false);
    }
  }, [params.entryId]);

  useEffect(() => {
    void fetchEntry();
  }, [fetchEntry]);

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Waiting list', href: '/waiting-list' },
              { label: entry ? `${entry.child_first_name} ${entry.child_last_name}` : 'Entry' },
            ]}
          />

          {isLoading ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <LoadingSpinner message="Loading..." size="md" />
            </div>
          ) : error || !entry ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <ErrorState message={error ?? 'Not found'} onRetry={fetchEntry} />
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="font-serif text-5xl sm:text-6xl text-dark-primary tracking-tight mb-2">
                  {entry.child_first_name} {entry.child_last_name}
                </h1>
                <p className="text-grey-600 text-lg">
                  {WAITING_LIST_STATUS_LABELS[entry.status]}
                  {entry.position > 0 ? `, position ${entry.position} on the list` : ''}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <section className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-8 shadow-lg">
                  <h2 className="font-serif text-2xl text-dark-primary mb-5">
                    About the {MEMBER_NOUN_LOWER}
                  </h2>
                  <dl className="space-y-4">
                    <Field label="Date of birth" value={formatDate(entry.child_dob)} />
                    <Field label="Gender" value={entry.child_gender ?? 'Not recorded'} />
                    <Field
                      label="Joined the list"
                      value={formatDate(entry.joined_at, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    />
                    <Field
                      label="Looking for"
                      value={entry.preferred_squad?.squad_name ?? describeWants(entry)}
                    />
                    {entry.notes && <Field label="Notes" value={entry.notes} />}
                  </dl>
                </section>

                <section className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-8 shadow-lg">
                  <h2 className="font-serif text-2xl text-dark-primary mb-5">Parent</h2>
                  <dl className="space-y-4">
                    <Field label="Name" value={entry.parent_name} />
                    <Field label="Email" value={entry.parent_email} />
                    <Field label="Phone" value={entry.parent_phone ?? 'Not given'} />
                  </dl>

                  <h3 className="font-serif text-xl text-dark-primary mt-8 mb-4">
                    Why they sit here
                  </h3>
                  <ul className="space-y-2 text-grey-600 text-sm">
                    {entry.priority_boost > 0 && (
                      <li>
                        An administrator gave them a priority boost of {entry.priority_boost}.
                      </li>
                    )}
                    {entry.is_existing_member_family && (
                      <li>Their family already has a child at the club.</li>
                    )}
                    {entry.is_sibling && (
                      <li>They are a sibling of a current {MEMBER_NOUN_LOWER}.</li>
                    )}
                    {!entry.priority_boost &&
                      !entry.is_existing_member_family &&
                      !entry.is_sibling && (
                        <li>No priority flags, so their place is by how long they have waited.</li>
                      )}
                  </ul>
                </section>
              </div>

              <section className="bg-dark-primary rounded-3xl border border-white/10 shadow-lg overflow-hidden">
                <div className="p-6 border-b border-white/10">
                  <h2 className="font-serif text-3xl text-white">Offers</h2>
                </div>
                {entry.offers.length === 0 ? (
                  <p className="px-6 py-8 text-text-secondary">
                    No place has been offered yet. One will be, automatically, as soon as a suitable
                    class has room.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {entry.offers.map((offer) => (
                      <li key={offer.offer_id} className="px-6 py-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-white font-semibold">
                              {offer.squad?.squad_name ?? 'A class'}
                            </p>
                            <p className="text-text-secondary text-sm">
                              Offered{' '}
                              {formatDate(offer.offered_at, {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                              , reply by{' '}
                              {formatDate(offer.expires_at, {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </p>
                            {offer.decline_reason && (
                              <p className="text-text-tertiary text-sm mt-1">
                                Reason given: {offer.decline_reason}
                              </p>
                            )}
                          </div>
                          <span className="px-3 py-1 bg-white/5 text-text-secondary rounded-full text-xs font-semibold flex-shrink-0">
                            {WAITING_LIST_OFFER_STATUS_LABELS[offer.status]}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-grey-400 text-xs font-semibold uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-dark-primary">{value}</dd>
    </div>
  );
}
