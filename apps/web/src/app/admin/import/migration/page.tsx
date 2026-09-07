'use client';

import { ArrowLeft, ArrowRight, Check, RotateCcw, SkipForward } from 'lucide-react';
import Link from 'next/link';

import MigrationChecklist from '@/components/import/MigrationChecklist';
import MainLayout from '@/components/layout/MainLayout';
import { useMigrationJourney } from '@/hooks/useMigrationJourney';
import {
  MIGRATION_STEPS,
  type MigrationStepId,
  type MigrationStepStatus,
  currentStepId,
  isJourneyComplete,
  journeyProgress,
  stepStatus,
} from '@/lib/import/migration-journey';

const STATUS_LABEL: Record<MigrationStepStatus, string> = {
  done: 'Done',
  skipped: 'Skipped',
  current: 'Next up',
  upcoming: 'Waiting',
};

const STATUS_BADGE: Record<MigrationStepStatus, string> = {
  done: 'bg-brand bg-opacity-20 text-brand',
  skipped: 'bg-white/10 text-white/70',
  current: 'bg-brand text-dark-primary',
  upcoming: 'bg-white/5 text-white/50',
};

export default function MigrationJourneyPage() {
  const { journey, loaded, skip, reopen, abandon } = useMigrationJourney();

  if (!loaded) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-5xl mx-auto">
            <p className="text-grey-600">Loading your migration...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!journey) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-5xl mx-auto">
            <h1 className="font-serif text-4xl text-dark-primary tracking-tight mb-2">
              No migration in progress
            </h1>
            <p className="text-grey-600 mb-6 max-w-2xl">
              Nothing is saved in this browser. Start by telling us where your club&apos;s data
              lives today, and the steps are put in order for you.
            </p>
            <Link
              href="/admin/import"
              className="min-h-[48px] px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-dark transition-all inline-flex items-center gap-2"
            >
              <span>Choose your sources</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const progress = journeyProgress(journey);
  const current = currentStepId(journey);
  const complete = isJourneyComplete(journey);
  const percent = progress.total === 0 ? 0 : Math.round((progress.settled / progress.total) * 100);

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <Link
              href="/admin/import"
              className="inline-flex items-center space-x-2 text-text-secondary hover:text-brand transition-colors mb-3 min-h-[48px]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to sources</span>
            </Link>
            <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">
              {complete ? 'Your migration is done' : 'Your migration'}
            </h1>
            <p className="text-grey-600 text-lg max-w-3xl">
              {complete
                ? 'Every step has been run or skipped. Here is what came across and what is left for you to do.'
                : 'Work down the list. Each step opens its importer and brings you back here when it finishes. Your progress is kept in this browser, so you can stop and pick it up later.'}
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-dark-primary font-semibold">
                {progress.settled} of {progress.total} step{progress.total !== 1 ? 's' : ''} done
              </p>
              <p className="text-grey-600 text-sm">{percent}%</p>
            </div>
            {/* One segment per step, so the fill needs no runtime width. */}
            <div
              className="flex gap-1"
              role="progressbar"
              aria-valuenow={progress.settled}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-label="Migration progress"
            >
              {journey.steps.map((stepId) => {
                const status = stepStatus(journey, stepId);
                return (
                  <span
                    key={stepId}
                    className={`h-2 flex-1 rounded-full ${
                      status === 'done'
                        ? 'bg-brand'
                        : status === 'skipped'
                          ? 'bg-dark-primary/30'
                          : 'bg-dark-primary/10'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <ol className="space-y-4 mb-10">
            {journey.steps.map((stepId, index) => (
              <JourneyStepRow
                key={stepId}
                stepId={stepId}
                index={index}
                status={stepStatus(journey, stepId)}
                isCurrent={current === stepId}
                onSkip={() => skip(stepId)}
                onReopen={() => reopen(stepId)}
              />
            ))}
          </ol>

          {complete && <MigrationChecklist journey={journey} />}

          <div className="mt-10 pt-6 border-t border-dark-primary/10 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={abandon}
              className="min-h-[48px] px-6 py-3 rounded-xl border border-dark-primary/20 text-dark-primary font-semibold hover:bg-dark-primary/5 transition-all"
            >
              {complete ? 'Clear this migration' : 'Abandon this migration'}
            </button>
            <p className="text-grey-600 text-sm sm:self-center">
              Clearing only forgets the wizard&apos;s progress. Nothing already imported is removed.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function JourneyStepRow({
  stepId,
  index,
  status,
  isCurrent,
  onSkip,
  onReopen,
}: {
  stepId: MigrationStepId;
  index: number;
  status: MigrationStepStatus;
  isCurrent: boolean;
  onSkip: () => void;
  onReopen: () => void;
}) {
  const step = MIGRATION_STEPS[stepId];

  return (
    <li
      className={`rounded-3xl border p-6 ${
        isCurrent ? 'bg-dark-primary border-brand' : 'bg-dark-primary border-white/10'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="flex items-start gap-4">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
              status === 'done' ? 'bg-brand text-dark-primary' : 'bg-white/10 text-white'
            }`}
          >
            {status === 'done' ? <Check className="w-4 h-4" /> : index + 1}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="font-serif text-2xl text-white tracking-tight">{step.title}</h2>
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${STATUS_BADGE[status]}`}>
                {STATUS_LABEL[status]}
              </span>
              {step.optional && status !== 'done' && (
                <span className="text-white/50 text-xs">Optional</span>
              )}
            </div>
            <p className="text-white/70 text-sm max-w-2xl">{step.description}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
          {(status === 'done' || status === 'skipped') && (
            <button
              type="button"
              onClick={onReopen}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{status === 'done' ? 'Run again' : 'Put back'}</span>
            </button>
          )}
          {step.optional && (status === 'current' || status === 'upcoming') && (
            <button
              type="button"
              onClick={onSkip}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              <span>Skip</span>
            </button>
          )}
          {status !== 'done' && status !== 'skipped' && (
            <Link
              href={step.href}
              className={`min-h-[48px] px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                isCurrent
                  ? 'bg-brand text-dark-primary hover:bg-brand-light'
                  : 'border border-white/20 text-white hover:bg-white/5'
              }`}
            >
              <span>{isCurrent ? 'Start this step' : 'Open'}</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
