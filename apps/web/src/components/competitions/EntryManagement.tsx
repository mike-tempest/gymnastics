'use client';

import { Users, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  getCompetitionEntries,
  addCompetitionEntries,
  type CompetitionEntry,
  type CreateEntryInput,
} from '@/lib/api/competitions';
import { formatSwimTime, findQualifyingTime } from '@/lib/competitions-utils';
import { useCompetition } from '@/lib/hooks/useCompetitions';

import AddEntriesModal from './AddEntriesModal';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-white/10 text-grey-300 border-white/20',
  SUBMITTED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ACCEPTED: 'bg-green-500/10 text-green-400 border-green-500/20',
  WITHDRAWN: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface EntryManagementProps {
  competitionId: string;
}

function QualifyingBadge({
  entry,
  qualifyingTimes,
}: {
  entry: CompetitionEntry;
  qualifyingTimes: Parameters<typeof findQualifyingTime>[0];
}) {
  const standard = findQualifyingTime(qualifyingTimes, entry.distance, entry.stroke);
  if (!standard) return <span className="text-white/30 text-xs">-</span>;

  const referenceTime = entry.entry_time ?? entry.seed_time;
  if (referenceTime === null || referenceTime === undefined) {
    return <span className="text-white/30 text-xs" title="No entry time to compare">No time</span>;
  }

  // Faster (smaller) than or equal to the standard qualifies.
  if (Number(referenceTime) <= Number(standard.time)) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs font-medium border border-green-500/20"
        title={`Qualifying time: ${formatSwimTime(standard.time)}`}
      >
        <CheckCircle2 className="w-3 h-3" /> Qualifies
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-xs font-medium border border-amber-500/20"
      title={`Qualifying time: ${formatSwimTime(standard.time)}`}
    >
      <AlertTriangle className="w-3 h-3" /> Outside QT
    </span>
  );
}

export default function EntryManagement({ competitionId }: EntryManagementProps) {
  const { data: competition } = useCompetition(competitionId);
  const qualifyingTimes = competition?.qualifying_times ?? null;
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  async function loadEntries() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCompetitionEntries(competitionId);
      setEntries(data);
    } catch {
      setError('Failed to load entries.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, [competitionId]);

  async function handleAddEntries(newEntries: CreateEntryInput[]) {
    try {
      await addCompetitionEntries(competitionId, newEntries);
      toast.success(`${newEntries.length} ${newEntries.length === 1 ? 'entry' : 'entries'} added`);
      setShowAddModal(false);
      loadEntries();
    } catch {
      toast.error('Failed to add entries');
    }
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading entries..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadEntries} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold text-sm hover:bg-brand-light transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Entries
        </button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No entries yet"
          description="Add swimmers to this competition to get started."
          actionLabel="Add Entries"
          actionOnClick={() => setShowAddModal(true)}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {entries.map((entry) => (
              <div key={entry.entry_id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium">
                    {entry.swimmer?.first_name} {entry.swimmer?.last_name}
                  </p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[entry.status] || STATUS_STYLES.PENDING}`}>
                    {entry.status}
                  </span>
                </div>
                <p className="text-sm text-text-secondary">
                  {entry.distance}m {entry.stroke}
                  {entry.event_name && ` - ${entry.event_name}`}
                  {entry.age_group && ` (${entry.age_group})`}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-white/50">
                  <span>Entry: <span className="tabular-nums">{formatSwimTime(entry.entry_time)}</span></span>
                  <span>Seed: <span className="tabular-nums">{formatSwimTime(entry.seed_time)}</span></span>
                  <QualifyingBadge entry={entry} qualifyingTimes={qualifyingTimes} />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="pb-3 font-medium">Swimmer</th>
                  <th className="pb-3 font-medium">Event</th>
                  <th className="pb-3 font-medium">Distance</th>
                  <th className="pb-3 font-medium">Stroke</th>
                  <th className="pb-3 font-medium">Entry Time</th>
                  <th className="pb-3 font-medium">Seed Time</th>
                  <th className="pb-3 font-medium">Qualifying</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <tr key={entry.entry_id} className="text-sm">
                    <td className="py-3 text-white font-medium">
                      {entry.swimmer?.first_name} {entry.swimmer?.last_name}
                    </td>
                    <td className="py-3 text-white/70">{entry.event_name || '-'}</td>
                    <td className="py-3 text-white/70">{entry.distance}m</td>
                    <td className="py-3 text-white/70">{entry.stroke}</td>
                    <td className="py-3 text-white/70 tabular-nums">{formatSwimTime(entry.entry_time)}</td>
                    <td className="py-3 text-white/70 tabular-nums">{formatSwimTime(entry.seed_time)}</td>
                    <td className="py-3"><QualifyingBadge entry={entry} qualifyingTimes={qualifyingTimes} /></td>
                    <td className="py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[entry.status] || STATUS_STYLES.PENDING}`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAddModal && (
        <AddEntriesModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddEntries}
        />
      )}
    </div>
  );
}
