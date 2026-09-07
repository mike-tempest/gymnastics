'use client';

import { useEffect, useState } from 'react';

import { useFormatters } from '@/hooks/useFormatters';
import { MemberAwardProgress, getMemberAwardProgress } from '@/lib/api/awards';
import { MEMBER_NOUN_LOWER } from '@/lib/brand';

const STATUS_LABELS: Record<string, string> = {
  working_towards: 'Working towards',
  assessed: 'Assessed',
  awarded: 'Awarded',
};

const STATUS_CLASSES: Record<string, string> = {
  working_towards: 'bg-white/5 text-text-secondary',
  assessed: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
  awarded: 'bg-brand/20 text-brand border border-brand/40',
};

interface MemberAwardsProps {
  memberId: string;
}

/** Badge history for one gymnast, shown on their record. */
export default function MemberAwards({ memberId }: MemberAwardsProps) {
  const { formatDate } = useFormatters();
  const [progress, setProgress] = useState<MemberAwardProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    getMemberAwardProgress(memberId)
      .then((rows) => {
        if (!cancelled) setProgress(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the badge history.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  return (
    <>
      <h2 className="font-serif text-2xl text-white mb-4">Badges</h2>

      {isLoading ? (
        <p className="text-text-secondary text-sm">Loading badge history...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : progress.length === 0 ? (
        <p className="text-text-secondary text-sm">
          This {MEMBER_NOUN_LOWER} has not been assessed for a badge yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {progress.map((row) => {
            const date = row.awarded_on ?? row.assessed_on ?? row.started_on;
            return (
              <li
                key={row.progress_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-white/5 rounded-2xl border border-white/10"
              >
                <div className="min-w-0">
                  <p className="text-white font-semibold">{row.level?.name ?? 'Badge'}</p>
                  {row.level?.scheme?.name && (
                    <p className="text-text-secondary text-sm mt-1">{row.level.scheme.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {date && (
                    <span className="text-text-secondary text-sm tabular-nums">
                      {formatDate(date)}
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      STATUS_CLASSES[row.status] ?? STATUS_CLASSES.working_towards
                    }`}
                  >
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
