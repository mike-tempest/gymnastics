'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  type MigrationJourney,
  type MigrationSourceId,
  type MigrationStepId,
  type MigrationStepOutcome,
  clearJourney,
  createJourney,
  loadJourney,
  recordStepOutcome,
  reopenStep,
  saveJourney,
  skipStep,
  withSources,
} from '@/lib/import/migration-journey';

/**
 * The migration journey as React state, backed by localStorage so a club can
 * close the tab mid-migration and pick the same step up later.
 *
 * `loaded` stays false until the first client render has read storage, which
 * keeps the server-rendered markup and the first client render identical.
 */
export function useMigrationJourney() {
  const [journey, setJourney] = useState<MigrationJourney | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setJourney(loadJourney());
    setLoaded(true);
  }, []);

  const commit = useCallback((next: MigrationJourney) => {
    setJourney(next);
    saveJourney(next);
  }, []);

  const start = useCallback(
    (sources: MigrationSourceId[]) => {
      const next = createJourney(sources);
      commit(next);
      return next;
    },
    [commit]
  );

  const update = useCallback((sources: MigrationSourceId[]) => {
    setJourney((current) => {
      if (!current) return current;
      const next = withSources(current, sources);
      saveJourney(next);
      return next;
    });
  }, []);

  const skip = useCallback((stepId: MigrationStepId) => {
    setJourney((current) => {
      if (!current) return current;
      const next = skipStep(current, stepId);
      saveJourney(next);
      return next;
    });
  }, []);

  const reopen = useCallback((stepId: MigrationStepId) => {
    setJourney((current) => {
      if (!current) return current;
      const next = reopenStep(current, stepId);
      saveJourney(next);
      return next;
    });
  }, []);

  const abandon = useCallback(() => {
    clearJourney();
    setJourney(null);
  }, []);

  return { journey, loaded, start, update, skip, reopen, abandon };
}

export interface MigrationStepReporter {
  /** True when a saved journey includes this importer as one of its steps. */
  active: boolean;
  /** 1-based position of this step, for the banner. 0 when not in a journey. */
  position: number;
  total: number;
  /** Record what the import brought across and mark the step done. */
  record: (outcome: Omit<MigrationStepOutcome, 'completedAt'>) => void;
}

/**
 * Used by the individual importer pages. They stay usable on their own: when
 * there is no journey covering this step, `active` is false and `record` is a
 * no-op, so the page behaves exactly as it did before the wizard existed.
 */
export function useMigrationStepReporter(stepId: MigrationStepId): MigrationStepReporter {
  const [journey, setJourney] = useState<MigrationJourney | null>(null);

  useEffect(() => {
    const stored = loadJourney();
    setJourney(stored && stored.steps.includes(stepId) ? stored : null);
  }, [stepId]);

  const record = useCallback(
    (outcome: Omit<MigrationStepOutcome, 'completedAt'>) => {
      // Read the journey back rather than trusting the copy loaded at mount, so
      // that progress made in another tab meanwhile is not overwritten.
      const current = loadJourney();
      if (!current || !current.steps.includes(stepId)) return;
      const next = recordStepOutcome(current, stepId, {
        ...outcome,
        completedAt: new Date().toISOString(),
      });
      saveJourney(next);
      setJourney(next);
    },
    [stepId]
  );

  const position = journey ? journey.steps.indexOf(stepId) + 1 : 0;

  return {
    active: journey !== null,
    position,
    total: journey ? journey.steps.length : 0,
    record,
  };
}
