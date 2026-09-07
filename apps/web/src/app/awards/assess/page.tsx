'use client';

import { Squad } from '@club-manager/shared-types';
import { ClipboardCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import {
  AssessmentOutcomeResult,
  AwardScheme,
  MemberAwardProgress,
  feeAmount,
  getAwardSchemes,
  getProgressForMembers,
  recordAssessment,
} from '@/lib/api/awards';
import { getMembers } from '@/lib/api/members';
import { getSquads } from '@/lib/api/squads';
import { MEMBER_NOUN_LOWER, MEMBER_NOUN_PLURAL, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

interface AssessableMember {
  member_id: string;
  first_name: string;
  last_name: string;
  squad_id: string | null;
}

const OUTCOME_OPTIONS: Array<{ value: AssessmentOutcomeResult; label: string }> = [
  { value: 'awarded', label: 'Awarded' },
  { value: 'not_yet', label: 'Not yet' },
  { value: 'working_towards', label: 'Still working towards' },
];

const STATUS_LABELS: Record<string, string> = {
  working_towards: 'Working towards',
  assessed: 'Assessed',
  awarded: 'Awarded',
};

export default function AssessAwardsPage() {
  const { formatCurrency } = useFormatters();

  const [schemes, setSchemes] = useState<AwardScheme[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [members, setMembers] = useState<AssessableMember[]>([]);
  const [progress, setProgress] = useState<MemberAwardProgress[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [levelId, setLevelId] = useState('');
  const [squadId, setSquadId] = useState('');
  const [assessedAt, setAssessedAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [billFees, setBillFees] = useState(true);
  const [outcomes, setOutcomes] = useState<Record<string, AssessmentOutcomeResult>>({});

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [schemesData, squadsData, membersData] = await Promise.all([
        getAwardSchemes(),
        getSquads(),
        getMembers(),
      ]);
      setSchemes(schemesData);
      setSquads(squadsData);
      setMembers(membersData as unknown as AssessableMember[]);
    } catch {
      setError('Could not load the assessment screen. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Every badge across every scheme, so a coach picks one from a single list.
  const levels = useMemo(
    () =>
      schemes.flatMap((scheme) =>
        scheme.levels
          .filter((level) => level.active)
          .map((level) => ({ ...level, schemeName: scheme.name }))
      ),
    [schemes]
  );

  const selectedLevel = levels.find((level) => level.level_id === levelId) ?? null;
  const selectedBadgeFee = feeAmount(selectedLevel?.badge_fee);
  const selectedCertificateFee = feeAmount(selectedLevel?.certificate_fee);

  const squadMembers = useMemo(
    () => (squadId ? members.filter((member) => member.squad_id === squadId) : members),
    [members, squadId]
  );

  // Load what these gymnasts have already done on the chosen badge, so a coach
  // can see who is already awarded before recording anything.
  useEffect(() => {
    if (squadMembers.length === 0) {
      setProgress([]);
      return;
    }
    let cancelled = false;
    void getProgressForMembers(squadMembers.map((member) => member.member_id))
      .then((rows) => {
        if (!cancelled) setProgress(rows);
      })
      .catch(() => {
        if (!cancelled) setProgress([]);
      });
    return () => {
      cancelled = true;
    };
  }, [squadMembers]);

  const progressFor = (memberId: string): MemberAwardProgress | undefined =>
    progress.find((row) => row.member_id === memberId && row.level_id === levelId);

  const setOutcome = (memberId: string, outcome: AssessmentOutcomeResult | '') => {
    setOutcomes((current) => {
      const next = { ...current };
      if (outcome === '') {
        delete next[memberId];
      } else {
        next[memberId] = outcome;
      }
      return next;
    });
  };

  const recorded = Object.entries(outcomes);
  const awardedCount = recorded.filter(([, outcome]) => outcome === 'awarded').length;
  const chargeable = selectedBadgeFee !== null || selectedCertificateFee !== null;
  const totalToBill =
    billFees && chargeable
      ? awardedCount * ((selectedBadgeFee ?? 0) + (selectedCertificateFee ?? 0))
      : 0;

  const handleSubmit = async () => {
    if (!levelId || recorded.length === 0) return;

    try {
      setIsSubmitting(true);
      const result = await recordAssessment({
        level_id: levelId,
        assessed_at: assessedAt,
        notes: notes.trim() ? notes : null,
        bill_fees: billFees,
        outcomes: recorded.map(([member_id, outcome]) => ({ member_id, outcome })),
      });

      toast.success(
        `Recorded ${recorded.length} ${recorded.length === 1 ? 'result' : 'results'}. ` +
          `${result.awarded} awarded, ${result.invoices_raised} ${
            result.invoices_raised === 1 ? 'invoice' : 'invoices'
          } raised.`
      );
      for (const warning of result.warnings) {
        toast.error(warning);
      }

      setOutcomes({});
      setNotes('');
      if (squadMembers.length > 0) {
        setProgress(await getProgressForMembers(squadMembers.map((member) => member.member_id)));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record the assessment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Badges', href: '/awards' },
              { label: 'Assess' },
            ]}
          />

          <div className="mb-8">
            <h1 className="font-serif text-5xl sm:text-6xl text-dark-primary tracking-tight mb-2">
              Assess and award
            </h1>
            <p className="text-grey-600 text-lg">
              Record how a group got on with one badge. Awarding a priced badge invoices the family.
            </p>
          </div>

          {isLoading ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <LoadingSpinner message="Loading badges and squads..." size="md" />
            </div>
          ) : error ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <ErrorState message={error} onRetry={fetchData} />
            </div>
          ) : levels.length === 0 ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <EmptyState
                icon={ClipboardCheck}
                title="No badges to assess yet"
                description="An award scheme with at least one badge has to exist before you can assess against it."
                hint="An administrator sets these up on the Badges page."
                actionLabel="Go to Badges"
                actionHref="/awards"
              />
            </div>
          ) : (
            <>
              {/* Choose what is being assessed */}
              <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label
                      htmlFor="assess-level"
                      className="block text-sm font-semibold text-white mb-2"
                    >
                      Badge
                    </label>
                    <select
                      id="assess-level"
                      value={levelId}
                      onChange={(event) => {
                        setLevelId(event.target.value);
                        setOutcomes({});
                      }}
                      className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
                    >
                      <option value="">Choose a badge</option>
                      {schemes.map((scheme) => (
                        <optgroup key={scheme.scheme_id} label={scheme.name}>
                          {scheme.levels
                            .filter((level) => level.active)
                            .map((level) => (
                              <option key={level.level_id} value={level.level_id}>
                                {level.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="assess-squad"
                      className="block text-sm font-semibold text-white mb-2"
                    >
                      Squad
                    </label>
                    <select
                      id="assess-squad"
                      value={squadId}
                      onChange={(event) => {
                        setSquadId(event.target.value);
                        setOutcomes({});
                      }}
                      className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
                    >
                      <option value="">All {MEMBER_NOUN_PLURAL_LOWER}</option>
                      {squads.map((squad) => (
                        <option key={squad.squad_id} value={squad.squad_id}>
                          {squad.squad_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="assess-date"
                      className="block text-sm font-semibold text-white mb-2"
                    >
                      Date assessed
                    </label>
                    <input
                      id="assess-date"
                      type="date"
                      value={assessedAt}
                      onChange={(event) => setAssessedAt(event.target.value)}
                      className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>

                {selectedLevel && (
                  <p className="mt-6 text-text-secondary text-sm">
                    {selectedLevel.schemeName} {selectedLevel.name}
                    {selectedBadgeFee === null
                      ? ' has no badge fee.'
                      : ` costs ${formatCurrency(selectedBadgeFee)} per badge`}
                    {selectedCertificateFee !== null &&
                      ` plus ${formatCurrency(selectedCertificateFee)} per certificate`}
                    {selectedBadgeFee !== null && '.'}
                  </p>
                )}
              </div>

              {/* Record outcomes */}
              {levelId && (
                <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-6">
                  <div className="p-6 border-b border-white/10">
                    <h2 className="font-serif text-3xl text-white">
                      {squadId
                        ? (squads.find((squad) => squad.squad_id === squadId)?.squad_name ??
                          MEMBER_NOUN_PLURAL)
                        : MEMBER_NOUN_PLURAL}
                    </h2>
                  </div>

                  {squadMembers.length === 0 ? (
                    <p className="p-6 text-text-secondary text-sm">
                      There is no {MEMBER_NOUN_LOWER} in this squad to assess.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-4 px-6 text-sm font-semibold text-white">
                              Name
                            </th>
                            <th className="text-left py-4 px-6 text-sm font-semibold text-white">
                              Where they are now
                            </th>
                            <th className="text-left py-4 px-6 text-sm font-semibold text-white">
                              Result
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {squadMembers.map((member) => {
                            const existing = progressFor(member.member_id);
                            return (
                              <tr
                                key={member.member_id}
                                className="border-b border-white/10 hover:bg-white/5 transition-colors"
                              >
                                <td className="py-4 px-6 text-white font-semibold">
                                  {member.first_name} {member.last_name}
                                </td>
                                <td className="py-4 px-6 text-text-secondary text-sm">
                                  {existing
                                    ? (STATUS_LABELS[existing.status] ?? existing.status)
                                    : 'Not started'}
                                </td>
                                <td className="py-4 px-6">
                                  <label
                                    className="sr-only"
                                    htmlFor={`outcome-${member.member_id}`}
                                  >
                                    Result for {member.first_name} {member.last_name}
                                  </label>
                                  <select
                                    id={`outcome-${member.member_id}`}
                                    value={outcomes[member.member_id] ?? ''}
                                    onChange={(event) =>
                                      setOutcome(
                                        member.member_id,
                                        event.target.value as AssessmentOutcomeResult | ''
                                      )
                                    }
                                    className="min-h-[44px] px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
                                  >
                                    <option value="">Not assessed</option>
                                    {OUTCOME_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm */}
              {levelId && squadMembers.length > 0 && (
                <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 p-6 space-y-5">
                  <div>
                    <label
                      htmlFor="assess-notes"
                      className="block text-sm font-semibold text-white mb-2"
                    >
                      Notes for this assessment
                    </label>
                    <textarea
                      id="assess-notes"
                      rows={2}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                      placeholder="Anything worth recording about the session"
                    />
                  </div>

                  {chargeable && (
                    <label className="flex items-start gap-3 text-white">
                      <input
                        type="checkbox"
                        checked={billFees}
                        onChange={(event) => setBillFees(event.target.checked)}
                        className="w-5 h-5 mt-0.5 rounded border-white/20 bg-white/5"
                      />
                      <span className="text-sm">
                        Invoice families for the badges awarded. The invoice is emailed and
                        collected by Direct Debit like any other fee.
                      </span>
                    </label>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-text-secondary text-sm">
                      {recorded.length} {recorded.length === 1 ? 'result' : 'results'} to record,{' '}
                      {awardedCount} awarded
                      {totalToBill > 0 && `, ${formatCurrency(totalToBill)} to invoice`}
                    </p>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting || recorded.length === 0}
                      className="w-full sm:w-auto min-h-[48px] px-8 py-4 bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSubmitting ? 'Recording...' : 'Record assessment'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
