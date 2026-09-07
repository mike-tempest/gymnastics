'use client';

import { ArrowLeft, ArrowRight, Check, Route } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import ImportTemplateCards from '@/components/import/ImportTemplateCards';
import MainLayout from '@/components/layout/MainLayout';
import { useMigrationJourney } from '@/hooks/useMigrationJourney';
import { BRAND } from '@/lib/brand';
import {
  MIGRATION_JOURNEY_HREF,
  MIGRATION_SOURCES,
  MIGRATION_STEPS,
  type MigrationSourceId,
  isJourneyComplete,
  journeyProgress,
  orderStepsForSources,
} from '@/lib/import/migration-journey';

export default function ImportHubPage() {
  const router = useRouter();
  const { journey, loaded, start, update, abandon } = useMigrationJourney();
  const [selected, setSelected] = useState<MigrationSourceId[]>([]);
  const hydrated = useRef(false);

  // A club coming back mid-migration sees its own sources ticked, so adding a
  // system it forgot changes the journey instead of silently replacing it.
  useEffect(() => {
    if (!loaded || hydrated.current) return;
    hydrated.current = true;
    if (journey) setSelected(journey.sources);
  }, [loaded, journey]);

  const plannedSteps = orderStepsForSources(selected);
  const progress = journey ? journeyProgress(journey) : null;
  const finished = journey ? isJourneyComplete(journey) : false;

  const toggleSource = (id: MigrationSourceId) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    );
  };

  const handleStart = () => {
    if (selected.length === 0) return;
    if (journey) {
      // Keeps every step the new selection still needs, along with what it has
      // already imported. Only a dropped source loses its progress.
      update(selected);
    } else {
      start(selected);
    }
    router.push(MIGRATION_JOURNEY_HREF);
  };

  const handleStartOver = () => {
    abandon();
    setSelected([]);
  };

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin"
              className="inline-flex items-center space-x-2 text-text-secondary hover:text-brand transition-colors mb-3 min-h-[48px]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Admin Dashboard</span>
            </Link>
            <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">
              Where is your club&apos;s data today?
            </h1>
            <p className="text-grey-600 text-lg max-w-3xl">
              Pick everything that applies. Most clubs keep people in one place and money in
              another, so choose as many as you need and {BRAND.name} puts the imports in a sensible
              order: people first, then Direct Debits. You can stop after any step and come back.
            </p>
          </div>

          {/* Resume an existing journey */}
          {loaded && journey && progress && (
            <div className="mb-8 rounded-3xl border border-brand border-opacity-30 bg-brand bg-opacity-10 p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="flex items-start gap-3">
                  <Route className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-serif text-2xl text-dark-primary tracking-tight mb-1">
                      {finished ? 'Your migration is finished' : 'You have a migration in progress'}
                    </h2>
                    <p className="text-grey-600 text-sm">
                      {progress.settled} of {progress.total} step
                      {progress.total !== 1 ? 's' : ''} done. Starting again clears what the wizard
                      remembers. It does not remove anything already imported.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleStartOver}
                    className="min-h-[48px] px-6 py-3 rounded-xl border border-dark-primary/20 text-dark-primary font-semibold hover:bg-dark-primary/5 transition-all"
                  >
                    Start again
                  </button>
                  <Link
                    href={MIGRATION_JOURNEY_HREF}
                    className="min-h-[48px] px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-dark transition-all flex items-center justify-center gap-2"
                  >
                    <span>{finished ? 'View your checklist' : 'Continue migration'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Source selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {MIGRATION_SOURCES.map((source) => {
              const isSelected = selected.includes(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleSource(source.id)}
                  className={`text-left rounded-3xl border p-6 sm:p-8 transition-all min-h-[48px] ${
                    isSelected
                      ? 'bg-dark-primary border-brand ring-2 ring-brand'
                      : 'bg-dark-primary border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-start gap-4 mb-3">
                    <span
                      aria-hidden="true"
                      className={`w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 mt-1 ${
                        isSelected ? 'bg-brand border-brand' : 'border-white/30'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-dark-primary" />}
                    </span>
                    <h2 className="font-serif text-2xl text-white tracking-tight">
                      {source.title}
                    </h2>
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed">{source.summary}</p>
                </button>
              );
            })}
          </div>

          {/* The resulting journey */}
          <div className="mt-8 rounded-3xl bg-dark-primary border border-white/10 p-6 sm:p-8">
            <h2 className="font-serif text-2xl text-white tracking-tight mb-2">Your journey</h2>
            {plannedSteps.length === 0 ? (
              <p className="text-white/60 text-sm">
                Choose at least one source above and the steps appear here.
              </p>
            ) : (
              <>
                <ol className="space-y-3 mb-6">
                  {plannedSteps.map((stepId, index) => {
                    const step = MIGRATION_STEPS[stepId];
                    return (
                      <li key={stepId} className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-brand bg-opacity-20 text-brand text-sm font-bold flex items-center justify-center flex-shrink-0">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-white font-semibold">
                            {step.title}
                            {step.optional && (
                              <span className="text-white/50 font-normal text-sm"> (optional)</span>
                            )}
                          </p>
                          <p className="text-white/60 text-sm">{step.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {plannedSteps.includes('gocardless') && plannedSteps.length > 1 && (
                  <p className="text-white/50 text-sm mb-6">
                    The GoCardless takeover comes last on purpose. A mandate attaches to a family,
                    so the families have to be here before the Direct Debits arrive.
                  </p>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleStart}
              disabled={selected.length === 0}
              className="min-h-[48px] px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{journey ? 'Update your journey' : 'Start migration'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            {journey && (
              <p className="text-white/50 text-sm mt-3">
                Steps you keep hold on to what they have already imported. Removing a source drops
                its steps and forgets what they recorded here.
              </p>
            )}
          </div>

          {/* File-by-file route */}
          <div className="mt-12">
            <h2 className="font-serif text-3xl text-dark-primary tracking-tight mb-2">
              Or import one file at a time
            </h2>
            <p className="text-grey-600 max-w-3xl mb-6">
              The same importers, without the guided journey. Each has a template you can download
              and fill in.
            </p>
            <ImportTemplateCards />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
