'use client';

import { Member } from '@club-manager/shared-types';
import { Heart, ChevronRight, Battery, Waves } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { fetchParentMembers } from '@/lib/api/parent';
import { fetchTodayCheckIn, type WellbeingLog } from '@/lib/api/wellbeing';
import { MEMBER_NOUN_LOWER, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

function readinessColour(level: string): string {
  switch (level) {
    case 'green':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'amber':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'red':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-white/5 text-white/60 border-white/10';
  }
}

function readinessLabel(level: string): string {
  switch (level) {
    case 'green':
      return 'Good to go';
    case 'amber':
      return 'May need adjusting';
    case 'red':
      return 'Prefers land training';
    default:
      return level;
  }
}

interface MemberWithWellbeing extends Member {
  todayLog: WellbeingLog | null;
}

export default function WellbeingHubPage() {
  const [members, setMembers] = useState<MemberWithWellbeing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const memberData = await fetchParentMembers();
        const enriched = await Promise.all(
          memberData.map(async (member) => {
            const todayLog = await fetchTodayCheckIn(member.member_id).catch(
              () => null,
            );
            return { ...member, todayLog } as MemberWithWellbeing;
          }),
        );
        setMembers(enriched);
      } catch {
        setError('We could not load your wellbeing data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas p-4 md:p-8 flex items-center justify-center">
        <LoadingSpinner message="Loading wellbeing..." />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: 'Parent Portal', href: '/parent' }, { label: 'Wellbeing' }]} />

          {/* Header */}
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-dark-primary mb-1">Wellbeing</h1>
            <p className="text-grey-600 text-lg">
              Check in before each session so coaches can adapt training. All data is private.
            </p>
          </div>

          {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

          {!error && members.length === 0 ? (
            <div className="bg-dark-primary rounded-3xl border border-white/10 shadow-lg">
              <EmptyState
                icon={Heart}
                title={`No ${MEMBER_NOUN_PLURAL_LOWER} found`}
                description="Once your children are registered with the club, you can check in on their wellbeing here."
              />
            </div>
          ) : (
            !error && (
              <div className="space-y-3">
                {members.map((member) => (
                  <Link
                    key={member.member_id}
                    href={`/parent/children/${member.member_id}/wellbeing`}
                    className="flex items-center gap-4 p-5 bg-dark-primary rounded-2xl border border-white/10 shadow-lg hover:border-brand/40 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold">
                      {member.first_name[0]}
                      {member.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">
                        {member.first_name} {member.last_name}
                      </p>
                      {member.todayLog ? (
                        <div className="flex gap-3 mt-1 text-sm text-text-secondary">
                          <span className="flex items-center gap-1 tabular-nums">
                            <Battery className="w-3.5 h-3.5" /> {member.todayLog.energy_level}/5
                          </span>
                          <span className="flex items-center gap-1 tabular-nums">
                            <Waves className="w-3.5 h-3.5" /> {member.todayLog.comfort_in_water}/5
                          </span>
                        </div>
                      ) : (
                        <p className="text-text-secondary text-sm mt-1">No check-in today</p>
                      )}
                    </div>
                    {member.todayLog ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${readinessColour(member.todayLog.readiness)}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {readinessLabel(member.todayLog.readiness)}
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-white/60 border border-white/10">
                        Check in
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-brand transition-colors" />
                  </Link>
                ))}
              </div>
            )
          )}

          {/* Educational section */}
          <div className="bg-brand/5 border border-brand/20 rounded-2xl p-6 space-y-4">
            <h2 className="font-serif text-lg text-white">Why we track wellbeing</h2>
            <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
              <p>
                A quick daily check-in helps coaches understand how each {MEMBER_NOUN_LOWER} is feeling, so they can adapt sessions without needing to ask personal questions.
              </p>
              <p>
                Coaches only ever see a green, amber, or red indicator. They never see individual scores, private notes, or any cycle tracking data.
              </p>
              <p>
                Research shows that young {MEMBER_NOUN_PLURAL_LOWER}, particularly girls, are more likely to stay engaged in the sport when they feel supported and understood. Wellbeing tracking makes that possible without any awkward conversations.
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}
