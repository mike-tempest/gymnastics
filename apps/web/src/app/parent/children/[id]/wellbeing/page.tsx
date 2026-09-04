'use client';

import { Swimmer } from '@swim-nexus/shared-types';
import {
  Heart,
  Battery,
  Moon,
  Waves,
  ChevronLeft,
  Info,
  Plus,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { fetchParentSwimmer } from '@/lib/api/parent';
import {
  submitWellbeingCheckIn,
  fetchWellbeingHistory,
  fetchTodayCheckIn,
  submitCycleLog,
  fetchCycleHistory,
  type WellbeingLog,
  type CycleLog,
} from '@/lib/api/wellbeing';

// --- Helpers ---

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

function levelLabel(val: number): string {
  const labels = ['', 'Very low', 'Low', 'Moderate', 'Good', 'Excellent'];
  return labels[val] || '';
}

const SYMPTOM_OPTIONS = [
  'Cramps',
  'Fatigue',
  'Headache',
  'Bloating',
  'Mood changes',
  'Back pain',
  'Nausea',
];

// --- Page ---

interface PageProps {
  params: { id: string };
}

export default function WellbeingPage({ params }: PageProps) {
  const { id: swimmerId } = params;
  const { formatDate } = useFormatters();
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null);
  const [todayLog, setTodayLog] = useState<WellbeingLog | null>(null);
  const [history, setHistory] = useState<WellbeingLog[]>([]);
  const [cycleHistory, setCycleHistory] = useState<CycleLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check-in form
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState<number | null>(null);
  const [comfort, setComfort] = useState(3);
  const [notes, setNotes] = useState('');
  const [prefersLand, setPrefersLand] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Cycle form
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [cycleStart, setCycleStart] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [cycleNotes, setCycleNotes] = useState('');
  const [isCycleSubmitting, setIsCycleSubmitting] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'checkin' | 'history' | 'cycle'>('checkin');

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const [swimmerData, today, hist, cycles] = await Promise.all([
          fetchParentSwimmer(swimmerId),
          fetchTodayCheckIn(swimmerId).catch(() => null),
          fetchWellbeingHistory(swimmerId, 14),
          fetchCycleHistory(swimmerId, 6).catch(() => []),
        ]);
        setSwimmer(swimmerData);
        setTodayLog(today);
        setHistory(hist);
        setCycleHistory(cycles);

        if (today) {
          setEnergy(today.energy_level);
          setSleep(today.sleep_quality);
          setComfort(today.comfort_in_water);
          setNotes(today.notes || '');
          setPrefersLand(today.prefers_land_training);
        }
      } catch {
        setError('Failed to load wellbeing data.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [swimmerId]);

  async function handleCheckInSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setSubmitSuccess(false);
      const today = new Date().toISOString().split('T')[0];
      const result = await submitWellbeingCheckIn({
        swimmer_id: swimmerId,
        log_date: today,
        energy_level: energy,
        sleep_quality: sleep ?? undefined,
        comfort_in_water: comfort,
        notes: notes || undefined,
        prefers_land_training: prefersLand,
      });
      setTodayLog(result);
      setSubmitSuccess(true);
      // Refresh history
      const hist = await fetchWellbeingHistory(swimmerId, 14);
      setHistory(hist);
    } catch {
      setError('Failed to submit check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCycleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cycleStart) return;
    try {
      setIsCycleSubmitting(true);
      await submitCycleLog({
        swimmer_id: swimmerId,
        period_start: cycleStart,
        period_end: cycleEnd || undefined,
        symptoms: symptoms.length > 0 ? symptoms : undefined,
        notes: cycleNotes || undefined,
      });
      setShowCycleForm(false);
      setCycleStart('');
      setCycleEnd('');
      setSymptoms([]);
      setCycleNotes('');
      const cycles = await fetchCycleHistory(swimmerId, 6);
      setCycleHistory(cycles);
    } catch {
      setError('Failed to save cycle log.');
    } finally {
      setIsCycleSubmitting(false);
    }
  }

  function toggleSymptom(symptom: string) {
    setSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom],
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas p-4 md:p-8 flex items-center justify-center">
        <LoadingSpinner message="Loading wellbeing..." />
      </div>
    );
  }

  if (error && !swimmer) {
    return (
      <div className="min-h-dvh bg-canvas p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
            items={[
              { label: 'My Children', href: '/parent/children' },
              { label: swimmer?.first_name || 'Child', href: `/parent/children/${swimmerId}` },
              { label: 'Wellbeing' },
            ]}
          />

          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/parent/children/${swimmerId}`}
                aria-label="Back to child overview"
                className="flex-shrink-0 p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button bg-dark-primary/80 hover:bg-dark-primary transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </Link>
              <div className="min-w-0">
                <h1 className="font-serif text-3xl md:text-4xl text-dark-primary truncate">
                  {swimmer?.first_name}&apos;s wellbeing
                </h1>
                <p className="text-grey-600 mt-1">
                  How are they feeling ahead of today&apos;s session?
                </p>
              </div>
            </div>
            {todayLog && (
              <span
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${readinessColour(todayLog.readiness)}`}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                {todayLog.readiness === 'green'
                  ? 'Good to go'
                  : todayLog.readiness === 'amber'
                    ? 'May need adjusting'
                    : 'Prefers land training'}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-dark-primary rounded-xl p-1 border border-white/10">
            {(['checkin', 'history', 'cycle'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-brand/20 text-brand'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab === 'checkin'
                  ? 'Check-in'
                  : tab === 'history'
                    ? 'History'
                    : 'Cycle Tracker'}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Check-in tab */}
          {activeTab === 'checkin' && (
            <form onSubmit={handleCheckInSubmit} className="space-y-6">
              {submitSuccess && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-green-400 text-sm font-medium">
                    Check-in saved. {todayLog?.readiness === 'green' ? 'Looking great today!' : todayLog?.readiness === 'amber' ? 'Coach will be aware they may need a lighter session.' : 'Coach will know they prefer land-based drills today.'}
                  </p>
                </div>
              )}

              {/* Energy */}
              <div className="bg-dark-primary rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Battery className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Energy level</h3>
                    <p className="text-text-secondary text-sm">How energetic are they feeling?</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEnergy(val)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border ${
                        energy === val
                          ? 'bg-brand/20 text-brand border-brand/30'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-secondary text-center">{levelLabel(energy)}</p>
              </div>

              {/* Sleep quality (optional) */}
              <div className="bg-dark-primary rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Sleep quality <span className="text-text-secondary font-normal text-sm">(optional)</span></h3>
                    <p className="text-text-secondary text-sm">How well did they sleep last night?</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSleep(sleep === val ? null : val)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border ${
                        sleep === val
                          ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                {sleep && (
                  <p className="text-xs text-text-secondary">{levelLabel(sleep)}</p>
                )}
              </div>

              {/* Comfort in water */}
              <div className="bg-dark-primary rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Waves className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Comfort in water</h3>
                    <p className="text-text-secondary text-sm">How comfortable do they feel getting in the pool today?</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setComfort(val)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border ${
                        comfort === val
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-secondary">{levelLabel(comfort)}</p>
              </div>

              {/* Land training preference */}
              <div className="bg-dark-primary rounded-2xl p-6 border border-white/10">
                <label className="flex items-center gap-4 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={prefersLand}
                      onChange={(e) => setPrefersLand(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-brand transition-colors" />
                    <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-5" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Prefer land-based training today</p>
                    <p className="text-text-secondary text-sm">
                      Coach will see this as a preference, no details shared
                    </p>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div className="bg-dark-primary rounded-2xl p-6 border border-white/10 space-y-3">
                <h3 className="text-white font-semibold">Private notes <span className="text-text-secondary font-normal text-sm">(optional)</span></h3>
                <p className="text-text-secondary text-sm">These are only visible to you. Coaches cannot see these notes.</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any extra details..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-brand hover:bg-brand-dark disabled:opacity-50 text-dark-primary font-semibold rounded-xl transition-colors"
              >
                {isSubmitting ? 'Saving...' : todayLog ? 'Update check-in' : 'Submit check-in'}
              </button>

              {/* Educational info */}
              <div className="bg-brand/5 border border-brand/20 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-brand" />
                  <h3 className="text-white font-semibold">What coaches see</h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  Coaches only see a simple green, amber, or red indicator next to your child&apos;s name on the attendance register. They never see the individual scores, notes, or any cycle data. This helps them adapt the session without any awkward conversations.
                </p>
              </div>
            </form>
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="bg-dark-primary rounded-3xl border border-white/10 shadow-lg">
                  <EmptyState
                    icon={Heart}
                    title="No check-ins yet"
                    description="Submit your first check-in to start tracking wellbeing over time."
                  />
                </div>
              ) : (
                history.map((log) => (
                  <div
                    key={log.log_id}
                    className="bg-dark-primary rounded-2xl p-5 border border-white/10 shadow-lg flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-white font-medium tabular-nums">{formatDate(log.log_date)}</p>
                      <div className="flex gap-4 text-sm text-text-secondary">
                        <span className="flex items-center gap-1 tabular-nums">
                          <Battery className="w-3.5 h-3.5" /> {log.energy_level}/5
                        </span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <Waves className="w-3.5 h-3.5" /> {log.comfort_in_water}/5
                        </span>
                        {log.sleep_quality && (
                          <span className="flex items-center gap-1 tabular-nums">
                            <Moon className="w-3.5 h-3.5" /> {log.sleep_quality}/5
                          </span>
                        )}
                      </div>
                      {log.prefers_land_training && (
                        <p className="text-xs text-yellow-400">Preferred land training</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${readinessColour(log.readiness)}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current" />
                      {log.readiness}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Cycle tracker tab */}
          {activeTab === 'cycle' && (
            <div className="space-y-6">
              {/* Educational banner */}
              <div className="bg-brand/5 border border-brand/20 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-brand" />
                  <h3 className="text-white font-semibold">About cycle tracking</h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  Swimming during your period is completely safe and can actually help reduce cramps. This tracker is entirely private and optional. Coaches never see any of this information. It is here to help you and your child understand how their cycle affects how they feel in training.
                </p>
                <p className="text-text-secondary text-sm leading-relaxed">
                  If your child prefers land-based drills on certain days, use the check-in form to let the coach know without sharing any personal details.
                </p>
              </div>

              {/* Add entry button */}
              {!showCycleForm && (
                <button
                  onClick={() => setShowCycleForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" /> Log period
                </button>
              )}

              {/* Cycle form */}
              {showCycleForm && (
                <form
                  onSubmit={handleCycleSubmit}
                  className="bg-dark-primary rounded-2xl p-6 border border-white/10 space-y-5"
                >
                  <h3 className="text-white font-semibold">Log period</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-1.5">Start date</label>
                      <input
                        type="date"
                        value={cycleStart}
                        onChange={(e) => setCycleStart(e.target.value)}
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-1.5">End date <span className="text-text-secondary font-normal">(optional)</span></label>
                      <input
                        type="date"
                        value={cycleEnd}
                        onChange={(e) => setCycleEnd(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Symptoms <span className="text-text-secondary font-normal">(optional)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {SYMPTOM_OPTIONS.map((symptom) => (
                        <button
                          key={symptom}
                          type="button"
                          onClick={() => toggleSymptom(symptom.toLowerCase())}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            symptoms.includes(symptom.toLowerCase())
                              ? 'bg-brand/20 text-brand border-brand/30'
                              : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {symptom}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-1.5">Notes <span className="text-text-secondary font-normal">(optional)</span></label>
                    <textarea
                      value={cycleNotes}
                      onChange={(e) => setCycleNotes(e.target.value)}
                      rows={2}
                      placeholder="Any additional notes..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCycleForm(false)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCycleSubmitting || !cycleStart}
                      className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-dark-primary font-semibold rounded-xl transition-colors"
                    >
                      {isCycleSubmitting ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )}

              {/* Cycle history */}
              {cycleHistory.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white font-semibold">Recent entries</h3>
                  {cycleHistory.map((entry) => (
                    <div
                      key={entry.log_id}
                      className="bg-dark-primary rounded-2xl p-5 border border-white/10 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-white font-medium tabular-nums">
                          <Calendar className="w-4 h-4 text-brand" />
                          {formatDate(entry.period_start)}
                          {entry.period_end && (
                            <span className="text-text-secondary">
                              to {formatDate(entry.period_end)}
                            </span>
                          )}
                        </div>
                      </div>
                      {entry.symptoms && entry.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {entry.symptoms.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/60 border border-white/10"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-text-secondary mt-2">{entry.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
}
