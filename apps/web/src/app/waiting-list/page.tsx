'use client';

import {
  DISCIPLINE_SHORT_LABELS,
  SQUAD_TYPE_LABELS,
  Squad,
  UserRole,
} from '@club-manager/shared-types';
import { ClipboardList, Settings2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EnrolResultDialog from '@/components/waiting-list/EnrolResultDialog';
import OfferModal from '@/components/waiting-list/OfferModal';
import PendingOffersPanel from '@/components/waiting-list/PendingOffersPanel';
import WaitingListSettingsCard from '@/components/waiting-list/WaitingListSettingsCard';
import { useConfirm } from '@/hooks/useConfirm';
import { getSquads } from '@/lib/api/squads';
import {
  enrolFromWaitingList,
  getPendingOffers,
  getWaitingList,
  getWaitingListSettings,
  offerPlace,
  updateWaitingListSettings,
  withdrawOffer,
  withdrawWaitingListEntry,
  type EnrolmentResult,
  type WaitingListOffer,
  type WaitingListRow,
  type WaitingListSettings,
  type WaitingListStatus,
} from '@/lib/api/waiting-list';
import { MEMBER_NOUN_LOWER, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';
import { useRole } from '@/lib/hooks/useRole';

/**
 * The club's waiting list (TEM-22).
 *
 * Not the launch waitlist at /admin/waitlist, which is a different thing
 * entirely: that one is clubs signing up to hear about the product.
 */

const STATUS_TABS: Array<{ label: string; value: WaitingListStatus | 'all' }> = [
  { label: 'Waiting', value: 'waiting' },
  { label: 'Offered', value: 'offered' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Everyone', value: 'all' },
];

/** Whole years old today, so the list reads the way a coach thinks. */
function ageInYears(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** What the family asked for, in short form, or that they are open to anything. */
function describeWants(row: WaitingListRow): string {
  const parts = [
    row.desired_squad_type ? SQUAD_TYPE_LABELS[row.desired_squad_type] : null,
    row.desired_discipline ? DISCIPLINE_SHORT_LABELS[row.desired_discipline] : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Anything';
}

function waitingFor(joinedAt: string): string {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(joinedAt).getTime()) / (24 * 60 * 60 * 1000))
  );
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

export default function WaitingListPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const { role } = useRole();
  // Offers, enrolment and withdrawals are @Roles(SUPER_ADMIN, HEAD_COACH) on
  // the API, so anyone else sees the list without the buttons that would 403.
  const canManage = role === UserRole.SUPER_ADMIN || role === UserRole.HEAD_COACH;
  const canChangeSettings = role === UserRole.SUPER_ADMIN;

  const [rows, setRows] = useState<WaitingListRow[]>([]);
  const [offers, setOffers] = useState<WaitingListOffer[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [settings, setSettings] = useState<WaitingListSettings | null>(null);
  const [statusFilter, setStatusFilter] = useState<WaitingListStatus | 'all'>('waiting');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [offerModalRow, setOfferModalRow] = useState<WaitingListRow | null>(null);
  const [enrolResult, setEnrolResult] = useState<EnrolmentResult | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [listRows, pendingOffers, squadList, clubSettings] = await Promise.all([
        getWaitingList(statusFilter === 'all' ? {} : { status: statusFilter }),
        getPendingOffers(),
        getSquads(),
        getWaitingListSettings(),
      ]);
      setRows(listRows);
      setOffers(pendingOffers);
      setSquads(squadList);
      setSettings(clubSettings);
    } catch {
      setError('Could not load the waiting list. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const squadNameById = useMemo(
    () => new Map(squads.map((squad) => [squad.squad_id, squad.squad_name])),
    [squads]
  );

  const handleEnrol = async (row: WaitingListRow) => {
    const squadId = row.pending_offer?.squad_id ?? row.preferred_squad_id ?? null;
    const squadLabel = squadId ? (squadNameById.get(squadId) ?? 'their class') : null;
    const confirmed = await confirm({
      title: `Enrol ${row.child_first_name} ${row.child_last_name}`,
      description: squadLabel
        ? `This creates the family and the ${MEMBER_NOUN_LOWER} record, gives them a place in ${squadLabel}, raises the consent requests, sends the parent portal invite and starts the Direct Debit setup.`
        : `This creates the family and the ${MEMBER_NOUN_LOWER} record, raises the consent requests, sends the parent portal invite and starts the Direct Debit setup. No class place is given, because none is chosen.`,
      confirmLabel: 'Enrol now',
      cancelLabel: 'Not yet',
    });
    if (!confirmed) return;

    try {
      setBusyEntryId(row.entry_id);
      const result = await enrolFromWaitingList(row.entry_id, squadId);
      setEnrolResult(result);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not enrol this child');
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleWithdraw = async (row: WaitingListRow) => {
    const confirmed = await confirm({
      title: `Take ${row.child_first_name} off the list`,
      description:
        'Any live offer is released, and the place goes to the next family. This can be undone only by adding them again.',
      confirmLabel: 'Take them off',
      cancelLabel: 'Keep them on',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      setBusyEntryId(row.entry_id);
      await withdrawWaitingListEntry(row.entry_id);
      toast.success(`${row.child_first_name} taken off the waiting list`);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the waiting list');
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleOffer = async (squadId: string, expiresInDays?: number) => {
    if (!offerModalRow) return;
    try {
      await offerPlace(offerModalRow.entry_id, squadId, expiresInDays);
      toast.success(`Place offered to ${offerModalRow.child_first_name}`);
      setOfferModalRow(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not offer the place');
      throw err;
    }
  };

  const handleWithdrawOffer = async (offer: WaitingListOffer) => {
    const confirmed = await confirm({
      title: 'Withdraw this offer',
      description:
        'The family is no longer holding the place, and it is offered to the next eligible child straight away.',
      confirmLabel: 'Withdraw offer',
      cancelLabel: 'Leave it',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await withdrawOffer(offer.offer_id);
      toast.success('Offer withdrawn');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not withdraw the offer');
    }
  };

  const handleSaveSettings = async (next: Partial<WaitingListSettings>) => {
    try {
      setSettings(await updateWaitingListSettings(next));
      toast.success('Waiting list settings saved');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the settings');
      throw err;
    }
  };

  const waitingCount = rows.filter((row) => row.status === 'waiting').length;

  return (
    <MainLayout>
      <ConfirmDialog />
      <EnrolResultDialog result={enrolResult} onClose={() => setEnrolResult(null)} />
      <OfferModal
        row={offerModalRow}
        squads={squads}
        defaultWindowDays={settings?.offer_window_days ?? 7}
        onSubmit={handleOffer}
        onClose={() => setOfferModalRow(null)}
      />

      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Waiting list' }]} />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-5xl sm:text-6xl text-dark-primary tracking-tight mb-2">
                Waiting list
              </h1>
              <p className="text-grey-600 text-lg">
                Places are offered automatically as they come up. One click turns an offer into an
                enrolled, billed {MEMBER_NOUN_LOWER}.
              </p>
            </div>
            {canChangeSettings && (
              <button
                onClick={() => setShowSettings((open) => !open)}
                aria-expanded={showSettings}
                className="w-full sm:w-auto px-6 py-3 min-h-[48px] bg-white text-dark-primary rounded-button font-bold border border-grey-200 hover:bg-grey-50 transition-all flex items-center justify-center gap-3"
              >
                <Settings2 className="w-5 h-5" aria-hidden="true" />
                <span>Settings</span>
              </button>
            )}
          </div>

          {showSettings && settings && (
            <WaitingListSettingsCard settings={settings} onSave={handleSaveSettings} />
          )}

          <PendingOffersPanel
            offers={offers}
            canManage={canManage}
            onWithdraw={handleWithdrawOffer}
          />

          {/* Status filter */}
          <div
            className="flex flex-wrap gap-2 mb-6"
            role="tablist"
            aria-label="Waiting list status"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={statusFilter === tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-5 py-2.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all border ${
                  statusFilter === tab.value
                    ? 'bg-dark-primary text-white border-dark-primary'
                    : 'bg-white text-dark-primary border-grey-200 hover:bg-grey-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <LoadingSpinner message="Loading the waiting list..." size="md" />
            </div>
          ) : error ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <ErrorState message={error} onRetry={fetchData} />
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <EmptyState
                icon={ClipboardList}
                title={
                  statusFilter === 'waiting' ? 'Nobody is waiting' : 'Nothing to show here yet'
                }
                description={`Share your club's join page and families add themselves, no account needed. When a place opens, the top of the list is offered it automatically.`}
                hint="The join page link is on your club settings screen."
                features={[
                  'Existing families and siblings are offered places first',
                  'Offers expire on their own and pass to the next family',
                  `One click creates the family, the ${MEMBER_NOUN_LOWER}, the register place, the consents and the Direct Debit`,
                ]}
              />
            </div>
          ) : (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10 flex items-baseline justify-between gap-4">
                <h2 className="font-serif text-3xl text-white">
                  {rows.length} {rows.length === 1 ? 'child' : 'children'}
                </h2>
                {statusFilter === 'all' && (
                  <p className="text-text-secondary text-sm">{waitingCount} still waiting</p>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-text-secondary text-xs uppercase tracking-wider">
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Position
                      </th>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Child
                      </th>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Age
                      </th>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Looking for
                      </th>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Waiting
                      </th>
                      <th scope="col" className="px-6 py-4 font-semibold">
                        Status
                      </th>
                      {canManage && (
                        <th scope="col" className="px-6 py-4 font-semibold text-right">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map((row) => (
                      <tr key={row.entry_id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-white font-serif text-2xl tabular-nums">
                          {row.position ?? '-'}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/waiting-list/${row.entry_id}`}
                            className="text-white font-semibold hover:text-brand transition-colors"
                          >
                            {row.child_first_name} {row.child_last_name}
                          </Link>
                          <p className="text-text-secondary text-sm">{row.parent_name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {row.priority_boost > 0 && (
                              <span className="px-2.5 py-1 bg-brand/20 text-brand rounded-full text-xs font-semibold border border-brand/40">
                                Priority {row.priority_boost}
                              </span>
                            )}
                            {row.is_existing_member_family && (
                              <span className="px-2.5 py-1 bg-white/5 text-text-secondary rounded-full text-xs font-semibold">
                                Club family
                              </span>
                            )}
                            {row.is_sibling && (
                              <span className="px-2.5 py-1 bg-white/5 text-text-secondary rounded-full text-xs font-semibold">
                                Sibling
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-text-secondary tabular-nums">
                          {ageInYears(row.child_dob)}
                        </td>
                        <td className="px-6 py-4 text-text-secondary text-sm">
                          {row.preferred_squad?.squad_name ?? describeWants(row)}
                        </td>
                        <td className="px-6 py-4 text-text-secondary text-sm">
                          {waitingFor(row.joined_at)}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge row={row} />
                        </td>
                        {canManage && (
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2 justify-end">
                              {(row.status === 'waiting' || row.status === 'offered') && (
                                <>
                                  <button
                                    onClick={() => handleEnrol(row)}
                                    disabled={busyEntryId === row.entry_id}
                                    className="px-4 py-2 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all text-sm disabled:opacity-60"
                                  >
                                    Enrol
                                  </button>
                                  {row.status === 'waiting' && (
                                    <button
                                      onClick={() => setOfferModalRow(row)}
                                      className="px-4 py-2 min-h-[44px] bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all text-sm"
                                    >
                                      Offer a place
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleWithdraw(row)}
                                    disabled={busyEntryId === row.entry_id}
                                    className="px-4 py-2 min-h-[44px] bg-white/5 text-text-secondary rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all text-sm disabled:opacity-60"
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                              {row.status === 'enrolled' && row.enrolled_member_id && (
                                <Link
                                  href={`/members/${row.enrolled_member_id}`}
                                  className="px-4 py-2 min-h-[44px] bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all text-sm inline-flex items-center gap-2"
                                >
                                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                                  <span>View {MEMBER_NOUN_LOWER}</span>
                                </Link>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-grey-400 text-sm mt-6">
            Position is worked out from priority and how long each child has waited, so it is not
            simply first come, first served. Enrolled and removed {MEMBER_NOUN_PLURAL_LOWER} keep no
            position.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}

function StatusBadge({ row }: { row: WaitingListRow }) {
  if (row.status === 'offered' && row.pending_offer) {
    const hoursLeft = Math.round(
      (new Date(row.pending_offer.expires_at).getTime() - Date.now()) / (60 * 60 * 1000)
    );
    return (
      <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-semibold border border-yellow-500/40">
        {hoursLeft > 24
          ? `Offered, ${Math.round(hoursLeft / 24)} days left`
          : hoursLeft > 0
            ? `Offered, ${hoursLeft}h left`
            : 'Offer lapsing'}
      </span>
    );
  }

  const styles: Record<string, string> = {
    waiting: 'bg-white/5 text-text-secondary',
    offered: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
    enrolled: 'bg-brand/20 text-brand border border-brand/40',
    withdrawn: 'bg-white/5 text-text-tertiary',
    expired: 'bg-white/5 text-text-tertiary',
  };
  const labels: Record<string, string> = {
    waiting: 'Waiting',
    offered: 'Offered',
    enrolled: 'Enrolled',
    withdrawn: 'Removed',
    expired: 'Lapsed',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[row.status]}`}>
      {labels[row.status]}
    </span>
  );
}
