'use client';

import { ChevronDown, ChevronRight, Medal, Pencil, Plus, Star, Trash2, Users, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  CompetitionResult,
  CreateResultInput,
  addCompetitionResult,
  deleteCompetitionResult,
  getCompetitionResults,
  updateCompetitionResult,
} from '@/lib/api/competitions';
import { MEMBER_NOUN } from '@/lib/brand';
import { formatSwimTime } from '@/lib/competitions-utils';

import AddResultModal from './AddResultModal';

interface EventGroup {
  key: string;
  eventName: string;
  distance: number;
  stroke: string;
  results: CompetitionResult[];
}

function groupResultsByEvent(results: CompetitionResult[]): EventGroup[] {
  const groups = new Map<string, EventGroup>();

  for (const result of results) {
    const key = `${result.event_name}-${result.distance}-${result.stroke}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        eventName: result.event_name || '',
        distance: result.distance,
        stroke: result.stroke,
        results: [],
      });
    }
    groups.get(key)!.results.push(result);
  }

  for (const group of Array.from(groups.values())) {
    group.results.sort((a: CompetitionResult, b: CompetitionResult) => {
      if (a.place !== null && b.place !== null) return a.place - b.place;
      if (a.place !== null) return -1;
      if (b.place !== null) return 1;
      return a.time - b.time;
    });
  }

  return Array.from(groups.values());
}

function getMemberName(result: CompetitionResult): string {
  if (result.member) {
    return `${result.member.first_name} ${result.member.last_name}`;
  }
  return `Unknown ${MEMBER_NOUN}`;
}

function SplitsRow({ splits, relayLegs }: { splits: number[]; relayLegs?: CompetitionResult['relay_legs'] }) {
  // Cumulative splits (strictly increasing) also get their lap time — the
  // difference from the previous split — which is what pacing is read from.
  const cumulative = splits.length > 1 && splits.every((s, i) => i === 0 || s > splits[i - 1]);
  const laps = cumulative ? splits.map((s, i) => (i === 0 ? s : s - splits[i - 1])) : null;
  const slowestLap = laps ? Math.max(...laps) : null;
  const fastestLap = laps ? Math.min(...laps) : null;

  return (
    <div className="px-4 py-3 bg-white/[0.02] border-t border-white/5 space-y-3">
      {relayLegs && relayLegs.length > 0 && (
        <div>
          <p className="text-text-secondary text-xs font-semibold mb-2">Relay legs</p>
          <div className="flex flex-wrap gap-3">
            {relayLegs.map((leg) => (
              <div key={leg.leg} className="bg-white/5 rounded-lg px-3 py-1.5">
                <span className="text-text-tertiary text-xs mr-1">{leg.leg}.</span>
                <span className="text-white text-sm">{leg.name ?? 'Unknown'}</span>
                {leg.split !== null && (
                  <span className="text-text-secondary text-sm tabular-nums ml-2">{formatSwimTime(leg.split)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {splits.length > 0 && (
        <div>
          <p className="text-text-secondary text-xs font-semibold mb-2">Splits</p>
          <div className="flex flex-wrap gap-3">
            {splits.map((split, i) => (
              <div key={i} className="bg-white/5 rounded-lg px-3 py-1.5">
                <span className="text-text-tertiary text-xs mr-1">{i + 1}.</span>
                <span className="text-white text-sm tabular-nums">{formatSwimTime(split)}</span>
                {laps && i > 0 && (
                  <span
                    className={`block text-xs tabular-nums mt-0.5 ${
                      laps[i] === fastestLap
                        ? 'text-green-400'
                        : laps[i] === slowestLap
                          ? 'text-amber-400'
                          : 'text-text-tertiary'
                    }`}
                  >
                    lap {formatSwimTime(laps[i])}
                  </span>
                )}
              </div>
            ))}
          </div>
          {laps && (
            <p className="text-text-tertiary text-xs mt-2">
              Fastest lap {formatSwimTime(fastestLap)} - slowest lap {formatSwimTime(slowestLap)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RelayBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold">
      <Users className="w-3 h-3" />
      Relay
    </span>
  );
}

function PBBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-semibold">
      <Star className="w-3 h-3" />
      PB
    </span>
  );
}

function DQBadge({ reason }: { reason: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold"
      title={reason ?? 'Disqualified'}
    >
      <XCircle className="w-3 h-3" />
      DQ
    </span>
  );
}

interface ResultRowActions {
  onEdit: (result: CompetitionResult) => void;
  onDelete: (result: CompetitionResult) => void;
}

function DesktopResultRow({ result, actions }: { result: CompetitionResult; actions: ResultRowActions }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = (result.splits && result.splits.length > 0) || (result.relay_legs && result.relay_legs.length > 0);
  const memberName = getMemberName(result);

  return (
    <>
      <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
        <td className="px-4 py-3">
          <button
            onClick={() => hasDetails && setExpanded(!expanded)}
            className={`flex items-center gap-2 min-h-[44px] ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
            disabled={!hasDetails}
            aria-expanded={hasDetails ? expanded : undefined}
            aria-label={hasDetails ? `${expanded ? 'Collapse' : 'Expand'} details for ${memberName}` : undefined}
          >
            {hasDetails && (
              expanded
                ? <ChevronDown className="w-4 h-4 text-text-tertiary" />
                : <ChevronRight className="w-4 h-4 text-text-tertiary" />
            )}
            <span className="text-white font-medium">{memberName}</span>
            {result.is_relay && <RelayBadge />}
          </button>
        </td>
        <td className="px-4 py-3">
          <span className={`tabular-nums text-sm ${result.dq ? 'text-red-400 line-through' : 'text-white'}`}>
            {formatSwimTime(result.time)}
          </span>
          {result.is_pb && <span className="ml-2"><PBBadge /></span>}
        </td>
        <td className="px-4 py-3 text-text-secondary text-sm">{result.place ?? '-'}</td>
        <td className="px-4 py-3 text-text-secondary text-sm">{result.heat ?? '-'}</td>
        <td className="px-4 py-3 text-text-secondary text-sm">{result.lane ?? '-'}</td>
        <td className="px-4 py-3">{result.dq && <DQBadge reason={result.dq_reason} />}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => actions.onEdit(result)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
              aria-label={`Edit result for ${memberName}`}
            >
              <Pencil className="w-4 h-4 text-text-tertiary" />
            </button>
            <button
              onClick={() => actions.onDelete(result)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
              aria-label={`Delete result for ${memberName}`}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr>
          <td colSpan={7}>
            <SplitsRow splits={result.splits ?? []} relayLegs={result.relay_legs} />
          </td>
        </tr>
      )}
    </>
  );
}

function MobileResultCard({ result, actions }: { result: CompetitionResult; actions: ResultRowActions }) {
  const [expanded, setExpanded] = useState(false);
  const hasSplits = (result.splits && result.splits.length > 0) || (result.relay_legs && result.relay_legs.length > 0);

  return (
    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
      <button
        onClick={() => hasSplits && setExpanded(!expanded)}
        className="w-full text-left min-h-[44px]"
        disabled={!hasSplits}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium flex items-center gap-2">
            {getMemberName(result)}
            {result.is_relay && <RelayBadge />}
          </span>
          {result.is_pb && <PBBadge />}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className={`tabular-nums ${result.dq ? 'text-red-400 line-through' : 'text-white'}`}>
            {formatSwimTime(result.time)}
          </span>
          {result.place !== null && (
            <span className="text-text-secondary">Place: {result.place}</span>
          )}
          {result.heat !== null && (
            <span className="text-text-secondary">Heat: {result.heat}</span>
          )}
          {result.lane !== null && (
            <span className="text-text-secondary">Lane: {result.lane}</span>
          )}
        </div>
        {result.dq && (
          <p className="mt-1 text-red-400 text-xs">
            DQ{result.dq_reason ? `: ${result.dq_reason}` : ''}
          </p>
        )}
        {hasSplits && (
          <div className="flex items-center gap-1 mt-2 text-text-tertiary text-xs">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>{expanded ? 'Hide' : 'Show'} splits</span>
          </div>
        )}
      </button>
      {expanded && hasSplits && <SplitsRow splits={result.splits ?? []} relayLegs={result.relay_legs} />}
      <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-white/5">
        <button
          onClick={() => actions.onEdit(result)}
          className="px-3 py-2 min-h-[44px] text-xs text-white/70 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          onClick={() => actions.onDelete(result)}
          className="px-3 py-2 min-h-[44px] text-xs text-red-400 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

function EventGroupSection({ group, actions }: { group: EventGroup; actions: ResultRowActions }) {
  return (
    <div className="bg-dark-primary rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 bg-white/[0.03] border-b border-white/10">
        <h3 className="text-white font-semibold text-lg">
          {group.distance}m {group.stroke}
        </h3>
        <p className="text-text-secondary text-sm">{group.eventName}</p>
      </div>

      <table className="hidden md:table w-full">
        <thead>
          <tr className="text-left text-text-secondary text-xs uppercase tracking-wider">
            <th className="px-4 py-2 font-semibold">{MEMBER_NOUN}</th>
            <th className="px-4 py-2 font-semibold">Time</th>
            <th className="px-4 py-2 font-semibold">Place</th>
            <th className="px-4 py-2 font-semibold">Heat</th>
            <th className="px-4 py-2 font-semibold">Lane</th>
            <th className="px-4 py-2 font-semibold">Status</th>
            <th className="px-4 py-2 font-semibold"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {group.results.map((result) => (
            <DesktopResultRow key={result.result_id} result={result} actions={actions} />
          ))}
        </tbody>
      </table>

      <div className="md:hidden flex flex-col gap-2 p-3">
        {group.results.map((result) => (
          <MobileResultCard key={result.result_id} result={result} actions={actions} />
        ))}
      </div>
    </div>
  );
}

interface ResultsViewProps {
  competitionId: string;
}

export default function ResultsView({ competitionId }: ResultsViewProps) {
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingResult, setEditingResult] = useState<CompetitionResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getCompetitionResults(competitionId)
      .then((data) => {
        if (!cancelled) {
          setResults(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load results');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [competitionId, reloadKey]);

  async function handleRecord(data: CreateResultInput) {
    try {
      await addCompetitionResult(competitionId, data);
      toast.success('Result recorded');
      setShowRecordModal(false);
      setReloadKey((k) => k + 1);
    } catch {
      toast.error('Failed to record result');
    }
  }

  async function handleEdit(data: CreateResultInput) {
    if (!editingResult) return;
    try {
      // Build the update payload explicitly so member_id is dropped without
      // an unused-variable binding (next build lints it, next lint does not).
      await updateCompetitionResult(competitionId, editingResult.result_id, {
        event_name: data.event_name,
        distance: data.distance,
        stroke: data.stroke,
        time: data.time,
        place: data.place,
        heat: data.heat,
        lane: data.lane,
        dq: data.dq,
        dq_reason: data.dq_reason,
        splits: data.splits,
        is_relay: data.is_relay,
        relay_legs: data.relay_legs,
      });
      toast.success('Result updated');
      setEditingResult(null);
      setReloadKey((k) => k + 1);
    } catch {
      toast.error('Failed to update result');
    }
  }

  async function handleDelete(result: CompetitionResult) {
    const name = result.member ? `${result.member.first_name} ${result.member.last_name}` : 'this member';
    if (!window.confirm(`Delete the ${result.distance}m ${result.stroke} result for ${name}? Personal bests will be recalculated.`)) {
      return;
    }
    try {
      await deleteCompetitionResult(competitionId, result.result_id);
      toast.success('Result deleted');
      setReloadKey((k) => k + 1);
    } catch {
      toast.error('Failed to delete result');
    }
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading results..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  const actions: ResultRowActions = {
    onEdit: (result) => setEditingResult(result),
    onDelete: handleDelete,
  };

  const groups = groupResultsByEvent(results);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">
          {results.length} result{results.length !== 1 ? 's' : ''} across {groups.length} event{groups.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowRecordModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Record Result
        </button>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={Medal}
          title="No results yet"
          description="No results have been recorded for this competition yet."
          hint="Record a time manually or use the Import button to upload results from a file."
        />
      ) : (
        groups.map((group) => <EventGroupSection key={group.key} group={group} actions={actions} />)
      )}

      {showRecordModal && (
        <AddResultModal onClose={() => setShowRecordModal(false)} onSubmit={handleRecord} />
      )}
      {editingResult && (
        <AddResultModal
          result={editingResult}
          onClose={() => setEditingResult(null)}
          onSubmit={handleEdit}
        />
      )}
    </div>
  );
}
