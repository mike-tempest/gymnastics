'use client';

import { Award, Check, Circle, Clock } from 'lucide-react';

import { useFormatters } from '@/hooks/useFormatters';
import { BadgeLadder, BadgeLadderLevel, BadgeLadderScheme } from '@/lib/api/awards';
import { MEMBER_NOUN_LOWER } from '@/lib/brand';

/**
 * A gymnast's badge ladders (TEM-21).
 *
 * Presentational only: it takes the ladder the caller has already fetched, so
 * the parent portal and the admin record can render the same progression from
 * their own endpoints.
 */
interface BadgeProgressProps {
  badges: BadgeLadder | null;
  isLoading?: boolean;
  error?: string | null;
  /** First name, so the copy can address this gymnast rather than a generic. */
  memberName?: string;
}

function isAwarded(level: BadgeLadderLevel): boolean {
  return level.status === 'awarded';
}

/** Where a level sits on the ladder, which decides how the row is drawn. */
type LevelState = 'awarded' | 'current' | 'ahead';

function levelState(level: BadgeLadderLevel, scheme: BadgeLadderScheme): LevelState {
  if (isAwarded(level)) return 'awarded';
  if (scheme.current_level?.level_id === level.level_id) return 'current';
  return 'ahead';
}

/**
 * The one line under a badge name. Dates only appear where they mean
 * something: the award date, the assessment date, or when work started.
 */
function statusLine(
  level: BadgeLadderLevel,
  state: LevelState,
  formatDate: (date: string) => string
): string {
  if (state === 'awarded') {
    return level.awarded_on ? `Awarded ${formatDate(level.awarded_on)}` : 'Awarded';
  }
  if (level.status === 'assessed') {
    return level.assessed_on
      ? `Assessed ${formatDate(level.assessed_on)}, result to follow`
      : 'Assessed, result to follow';
  }
  if (state === 'current') {
    return level.started_on
      ? `Working towards since ${formatDate(level.started_on)}`
      : 'Working towards';
  }
  return 'Still to come';
}

function LevelMarker({ state }: { state: LevelState }) {
  if (state === 'awarded') {
    return (
      <span className="flex-shrink-0 w-9 h-9 rounded-full bg-success/15 border border-success/40 flex items-center justify-center">
        <Check aria-hidden="true" className="w-5 h-5 text-success" />
      </span>
    );
  }

  if (state === 'current') {
    return (
      <span className="flex-shrink-0 w-9 h-9 rounded-full bg-brand/15 border border-brand/50 flex items-center justify-center">
        <Clock aria-hidden="true" className="w-5 h-5 text-brand" />
      </span>
    );
  }

  return (
    <span className="flex-shrink-0 w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
      <Circle aria-hidden="true" className="w-3 h-3 text-text-tertiary" />
    </span>
  );
}

export default function BadgeProgress({
  badges,
  isLoading = false,
  error = null,
  memberName,
}: BadgeProgressProps) {
  const { formatDate } = useFormatters();

  if (isLoading) {
    return <p className="text-text-secondary text-sm">Loading badge progress...</p>;
  }

  if (error) {
    return <p className="text-danger text-sm">{error}</p>;
  }

  const schemes = badges?.schemes ?? [];

  if (schemes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Award aria-hidden="true" className="w-12 h-12 text-text-tertiary mb-4" />
        <p className="text-white font-semibold mb-1">No badge scheme yet</p>
        <p className="text-text-secondary text-sm">
          Badges will appear here once the club sets up its award scheme.
        </p>
      </div>
    );
  }

  const who = memberName ?? `this ${MEMBER_NOUN_LOWER}`;

  return (
    <div className="space-y-8">
      {badges?.latest_award?.awarded_on ? (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-success/10 border border-success/25">
          <Award aria-hidden="true" className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <p className="text-white text-sm">
            <span className="font-semibold">{badges.latest_award.name}</span> awarded on{' '}
            <span className="tabular-nums">{formatDate(badges.latest_award.awarded_on)}</span>, in{' '}
            {badges.latest_award.scheme_name}.
          </p>
        </div>
      ) : (
        <p className="text-text-secondary text-sm">
          No badges awarded yet. Every scheme the club runs is shown below, so you can see what{' '}
          {who} is working towards.
        </p>
      )}

      {schemes.map((scheme) => (
        <section key={scheme.scheme_id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="font-serif text-xl text-white">{scheme.name}</h3>
            <p className="text-text-tertiary text-sm tabular-nums">
              {scheme.awarded_count} of {scheme.levels.length} awarded
            </p>
          </div>

          <ol className="space-y-2">
            {scheme.levels.map((level) => {
              const state = levelState(level, scheme);

              return (
                <li
                  key={level.level_id}
                  className={`flex items-center gap-4 p-3 rounded-2xl border ${
                    state === 'current'
                      ? 'bg-brand/10 border-brand/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <LevelMarker state={state} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-semibold ${
                        state === 'ahead' ? 'text-text-secondary' : 'text-white'
                      }`}
                    >
                      {level.name}
                    </p>
                    <p className="text-text-tertiary text-sm tabular-nums">
                      {statusLine(level, state, formatDate)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
