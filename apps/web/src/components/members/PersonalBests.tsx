'use client';

import { Trophy, Star } from 'lucide-react';
import { useState, useEffect } from 'react';

import ProgressionChart from '@/components/members/ProgressionChart';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import {
  getMemberPersonalBests,
  getMemberResults,
  type CompetitionResult,
  type MemberPersonalBests,
} from '@/lib/api/competitions';
import { formatSwimTime } from '@/lib/competitions-utils';

interface PersonalBestsProps {
  memberId: string;
  /**
   * Override the data sources so the same panel works in the parent portal,
   * which reads through /parent/children/:id endpoints instead of the
   * club-admin competitions API.
   */
  fetchPersonalBests?: (memberId: string) => Promise<MemberPersonalBests>;
  fetchResults?: (memberId: string) => Promise<CompetitionResult[]>;
  /** Shown instead of rendering nothing when the member has no times yet. */
  emptyMessage?: string;
}

function CourseBadge({ course }: { course: string }) {
  return (
    <span className="inline-flex px-1.5 py-0.5 bg-white/10 text-white/60 rounded text-[10px] font-semibold">
      {course}
    </span>
  );
}

export default function PersonalBests({
  memberId,
  fetchPersonalBests = getMemberPersonalBests,
  fetchResults = getMemberResults,
  emptyMessage,
}: PersonalBestsProps) {
  const { formatDate } = useFormatters();
  const { locale } = useClubRegion();
  const [data, setData] = useState<MemberPersonalBests | null>(null);
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPersonalBests(memberId), fetchResults(memberId)])
      .then(([pbData, resultData]) => {
        if (cancelled) return;
        setData(pbData);
        setResults(resultData);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load times');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId, fetchPersonalBests, fetchResults]);

  if (isLoading) return <LoadingSpinner message="Loading times..." size="sm" />;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data || (data.personalBests.length === 0 && results.length === 0)) {
    return emptyMessage ? <p className="text-text-secondary text-sm">{emptyMessage}</p> : null;
  }

  const seasonBestByKey = new Map(
    data.seasonBests.map((sb) => [`${sb.distance}|${sb.stroke}|${sb.course}`, sb])
  );
  const totalPBs = results.filter((r) => r.is_pb).length;

  const sortedPbs = [...data.personalBests].sort((a, b) => {
    if (a.stroke !== b.stroke) return a.stroke.localeCompare(b.stroke);
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.course.localeCompare(b.course);
  });

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-brand" />
            <h3 className="font-serif text-xl text-white">Personal Bests</h3>
          </div>
          <div className="flex gap-4 text-sm text-text-secondary">
            <span>{results.length} results</span>
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400" /> {totalPBs} PBs
            </span>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-white/50 border-b border-white/10">
                <th className="pb-3 font-medium">Event</th>
                <th className="pb-3 font-medium">All-Time Best</th>
                <th className="pb-3 font-medium">Season Best</th>
                <th className="pb-3 font-medium">Achieved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedPbs.map((pb) => {
                const seasonBest = seasonBestByKey.get(`${pb.distance}|${pb.stroke}|${pb.course}`);
                return (
                  <tr key={pb.pb_id} className="text-sm">
                    <td className="py-3 text-white font-medium">
                      {pb.distance}m {pb.stroke} <CourseBadge course={pb.course} />
                    </td>
                    <td className="py-3 text-white/70 font-mono tabular-nums">
                      {formatSwimTime(Number(pb.time))}
                    </td>
                    <td className="py-3 text-white/70 font-mono tabular-nums">
                      {seasonBest ? formatSwimTime(seasonBest.time) : '-'}
                      {seasonBest && Number(seasonBest.time) === Number(pb.time) && (
                        <Star className="inline w-3.5 h-3.5 text-yellow-400 fill-yellow-400 ml-1.5 align-text-bottom" />
                      )}
                    </td>
                    <td className="py-3 text-white/50">
                      {pb.achieved_at ? formatDate(pb.achieved_at) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-2 md:hidden">
          {sortedPbs.map((pb) => {
            const seasonBest = seasonBestByKey.get(`${pb.distance}|${pb.stroke}|${pb.course}`);
            return (
              <div
                key={pb.pb_id}
                className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10"
              >
                <div>
                  <p className="text-white font-medium text-sm">
                    {pb.distance}m {pb.stroke} <CourseBadge course={pb.course} />
                  </p>
                  <p className="text-white/50 text-xs">
                    {pb.achieved_at ? formatDate(pb.achieved_at) : ''}
                    {seasonBest ? ` - season ${formatSwimTime(seasonBest.time)}` : ''}
                  </p>
                </div>
                <span className="font-mono tabular-nums text-white/70">
                  {formatSwimTime(Number(pb.time))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ProgressionChart results={results} locale={locale} />
    </div>
  );
}
