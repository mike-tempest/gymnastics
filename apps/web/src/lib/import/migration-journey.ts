/**
 * The self-serve migration journey (TEM-24).
 *
 * A club picks the systems its data lives in today, and this module turns that
 * choice into an ordered list of importer steps, remembers how far the club has
 * got, and adds up what came across so the finish page can tell the truth.
 *
 * Everything here is pure apart from the three storage helpers at the bottom,
 * so the sequencing rules can be tested without a browser.
 *
 * Source facts come from docs/04-Incumbent-Landscape-Pricing-and-Exports.md and
 * the importer order in docs/05-Build-Brief-Positioning-and-Product-Rules.md.
 */

import { MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

export type MigrationSourceId = 'gocardless' | 'classforkids' | 'thrive4' | 'spreadsheet';

export type MigrationStepId =
  | 'squads'
  | 'classforkids'
  | 'members'
  | 'staff'
  | 'fees'
  | 'gocardless';

/** Whether a step brings people across or money. People always come first. */
export type MigrationPhase = 'people' | 'money';

export interface MigrationSource {
  id: MigrationSourceId;
  title: string;
  /** One factual line about what this club can actually export. */
  summary: string;
  /** The steps this source contributes, in no particular order. */
  steps: MigrationStepId[];
}

export interface MigrationStep {
  id: MigrationStepId;
  title: string;
  description: string;
  /** The existing importer route this step runs. */
  href: string;
  phase: MigrationPhase;
  /** Optional steps can be skipped without leaving the journey unfinished. */
  optional: boolean;
}

export type MigrationCountKey =
  | 'families'
  | 'members'
  | 'squadsCreated'
  | 'squadsMatched'
  | 'staff'
  | 'feeStructures'
  | 'mandates'
  | 'activeMandates';

export interface MigrationStepOutcome {
  /** ISO timestamp of when the step finished. */
  completedAt: string;
  counts: Partial<Record<MigrationCountKey, number>>;
  errorCount: number;
  warningCount: number;
}

export interface MigrationJourney {
  version: 1;
  startedAt: string;
  sources: MigrationSourceId[];
  /**
   * The ordered steps, resolved when the journey started. Stored rather than
   * derived on every read so that a later change to the catalogue cannot
   * silently reshape a journey a club is halfway through.
   */
  steps: MigrationStepId[];
  outcomes: Partial<Record<MigrationStepId, MigrationStepOutcome>>;
  skipped: MigrationStepId[];
}

export type MigrationStepStatus = 'done' | 'skipped' | 'current' | 'upcoming';

export const MIGRATION_JOURNEY_STORAGE_KEY = 'import-migration-journey-v1';

/** Where the journey itself lives, for links back from the importer pages. */
export const MIGRATION_JOURNEY_HREF = '/admin/import/migration';

export const MIGRATION_SOURCES: MigrationSource[] = [
  {
    id: 'gocardless',
    title: 'GoCardless',
    summary:
      'You collect Direct Debits in your own GoCardless organisation, either directly or through a tool such as Class Manager. The customers and mandates exports carry every live mandate across, so no parent sets one up again.',
    steps: ['gocardless'],
  },
  {
    id: 'classforkids',
    title: 'ClassForKids',
    summary:
      'ClassForKids has no single customer export and no API, so bring the per-screen spreadsheets you can download: contacts, class registers and the financial summary. Card payments cannot be moved, so families set up a Direct Debit here instead.',
    steps: ['classforkids', 'fees'],
  },
  {
    id: 'thrive4',
    title: 'Thrive4 or LoveAdmin',
    summary:
      'The contact export lets you choose the fields and the groups, so one CSV usually carries your people and their squads. Direct Debits collected on their rail cannot be transferred, so check who holds your mandates.',
    steps: ['members', 'fees'],
  },
  {
    id: 'spreadsheet',
    title: 'Spreadsheets or form responses',
    summary:
      'Google Forms, Jotform, a shared spreadsheet or a register printed from another tool. Map your columns once and the rest of the journey is the same.',
    steps: ['squads', 'members', 'staff', 'fees'],
  },
];

export const MIGRATION_STEPS: Record<MigrationStepId, MigrationStep> = {
  squads: {
    id: 'squads',
    title: 'Squads',
    description:
      'Set your training squads up first so people and fees can be matched to them. Skip this if your squads come across with your people.',
    href: '/admin/import/squads',
    phase: 'people',
    optional: true,
  },
  classforkids: {
    id: 'classforkids',
    title: 'ClassForKids spreadsheets',
    description: `Upload the contact, register and financial files together. Families, ${MEMBER_NOUN_PLURAL_LOWER} and classes are assembled from whichever of them you have.`,
    href: '/admin/import/classforkids',
    phase: 'people',
    optional: false,
  },
  members: {
    id: 'members',
    title: 'People and families',
    description: `Import your ${MEMBER_NOUN_PLURAL_LOWER} with their parents and families. Columns are matched for you, and anything unusual you map by hand.`,
    href: '/admin/import/members',
    phase: 'people',
    optional: false,
  },
  staff: {
    id: 'staff',
    title: 'Coaches and committee',
    description: 'Add your coaches, welfare officer and committee with their club roles.',
    href: '/admin/import/staff',
    phase: 'people',
    optional: true,
  },
  fees: {
    id: 'fees',
    title: 'Fee structures',
    description:
      'Set up your membership and squad fees so billing is ready before the first collection.',
    href: '/admin/import/fees',
    phase: 'money',
    optional: true,
  },
  gocardless: {
    id: 'gocardless',
    title: 'GoCardless takeover',
    description:
      'Bring your live mandates across. This runs last because a mandate can only attach to a family that already exists here.',
    href: '/admin/import/gocardless',
    phase: 'money',
    optional: false,
  },
};

/**
 * The order every journey follows. People before money: mandates and fees only
 * make sense once the families they belong to are in place.
 */
const STEP_ORDER: MigrationStepId[] = [
  'squads',
  'classforkids',
  'members',
  'staff',
  'fees',
  'gocardless',
];

const SOURCE_IDS = new Set<MigrationSourceId>(MIGRATION_SOURCES.map((source) => source.id));

export function getMigrationSource(id: MigrationSourceId): MigrationSource | undefined {
  return MIGRATION_SOURCES.find((source) => source.id === id);
}

/** The steps the chosen sources need, de-duplicated and in journey order. */
export function orderStepsForSources(sources: MigrationSourceId[]): MigrationStepId[] {
  const needed = new Set<MigrationStepId>();
  for (const id of sources) {
    for (const step of getMigrationSource(id)?.steps ?? []) {
      needed.add(step);
    }
  }
  return STEP_ORDER.filter((step) => needed.has(step));
}

export function createJourney(
  sources: MigrationSourceId[],
  now: Date = new Date()
): MigrationJourney {
  const unique = dedupeSources(sources);
  return {
    version: 1,
    startedAt: now.toISOString(),
    sources: unique,
    steps: orderStepsForSources(unique),
    outcomes: {},
    skipped: [],
  };
}

function dedupeSources(sources: MigrationSourceId[]): MigrationSourceId[] {
  const seen = new Set<MigrationSourceId>();
  const out: MigrationSourceId[] = [];
  for (const id of sources) {
    if (SOURCE_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Change which sources a journey covers without losing the work already done.
 * Progress on a step that is no longer needed is dropped, because leaving it in
 * the totals would credit the club with an import it is no longer doing.
 */
export function withSources(
  journey: MigrationJourney,
  sources: MigrationSourceId[]
): MigrationJourney {
  const unique = dedupeSources(sources);
  const steps = orderStepsForSources(unique);
  const kept = new Set(steps);
  const outcomes: MigrationJourney['outcomes'] = {};
  for (const [stepId, outcome] of Object.entries(journey.outcomes) as [
    MigrationStepId,
    MigrationStepOutcome,
  ][]) {
    if (kept.has(stepId)) outcomes[stepId] = outcome;
  }
  return {
    ...journey,
    sources: unique,
    steps,
    outcomes,
    skipped: journey.skipped.filter((stepId) => kept.has(stepId)),
  };
}

export function stepStatus(
  journey: MigrationJourney,
  stepId: MigrationStepId
): MigrationStepStatus {
  if (journey.outcomes[stepId]) return 'done';
  if (journey.skipped.includes(stepId)) return 'skipped';
  return currentStepId(journey) === stepId ? 'current' : 'upcoming';
}

/** The first step that is neither done nor skipped, or null when finished. */
export function currentStepId(journey: MigrationJourney): MigrationStepId | null {
  return (
    journey.steps.find(
      (stepId) => !journey.outcomes[stepId] && !journey.skipped.includes(stepId)
    ) ?? null
  );
}

export function isJourneyComplete(journey: MigrationJourney): boolean {
  return journey.steps.length > 0 && currentStepId(journey) === null;
}

/** How many steps are settled, for the progress line. */
export function journeyProgress(journey: MigrationJourney): { settled: number; total: number } {
  const settled = journey.steps.filter(
    (stepId) => journey.outcomes[stepId] || journey.skipped.includes(stepId)
  ).length;
  return { settled, total: journey.steps.length };
}

export function recordStepOutcome(
  journey: MigrationJourney,
  stepId: MigrationStepId,
  outcome: MigrationStepOutcome
): MigrationJourney {
  if (!journey.steps.includes(stepId)) return journey;
  return {
    ...journey,
    outcomes: { ...journey.outcomes, [stepId]: outcome },
    skipped: journey.skipped.filter((skippedId) => skippedId !== stepId),
  };
}

export function skipStep(journey: MigrationJourney, stepId: MigrationStepId): MigrationJourney {
  if (!journey.steps.includes(stepId)) return journey;
  if (journey.skipped.includes(stepId)) return journey;
  const outcomes = { ...journey.outcomes };
  delete outcomes[stepId];
  return { ...journey, outcomes, skipped: [...journey.skipped, stepId] };
}

/** Put a done or skipped step back in play so the club can run it again. */
export function reopenStep(journey: MigrationJourney, stepId: MigrationStepId): MigrationJourney {
  if (!journey.steps.includes(stepId)) return journey;
  const outcomes = { ...journey.outcomes };
  delete outcomes[stepId];
  return {
    ...journey,
    outcomes,
    skipped: journey.skipped.filter((skippedId) => skippedId !== stepId),
  };
}

export interface MigrationTotals {
  counts: Record<MigrationCountKey, number>;
  errorCount: number;
  warningCount: number;
  /** True when no step recorded a single row, so the finish page can say so. */
  isEmpty: boolean;
}

const COUNT_KEYS: MigrationCountKey[] = [
  'families',
  'members',
  'squadsCreated',
  'squadsMatched',
  'staff',
  'feeStructures',
  'mandates',
  'activeMandates',
];

export function journeyTotals(journey: MigrationJourney): MigrationTotals {
  const counts = Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as Record<
    MigrationCountKey,
    number
  >;
  let errorCount = 0;
  let warningCount = 0;

  for (const stepId of journey.steps) {
    const outcome = journey.outcomes[stepId];
    if (!outcome) continue;
    errorCount += outcome.errorCount;
    warningCount += outcome.warningCount;
    for (const key of COUNT_KEYS) {
      counts[key] += outcome.counts[key] ?? 0;
    }
  }

  return {
    counts,
    errorCount,
    warningCount,
    isEmpty: COUNT_KEYS.every((key) => counts[key] === 0),
  };
}

/**
 * Read a journey out of unknown JSON. Anything unrecognised is dropped rather
 * than trusted, so an old or hand-edited entry cannot break the wizard.
 */
export function parseJourney(raw: unknown): MigrationJourney | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) return null;

  const sources = dedupeSources(
    (Array.isArray(value.sources) ? value.sources : []).filter(
      (id): id is MigrationSourceId =>
        typeof id === 'string' && SOURCE_IDS.has(id as MigrationSourceId)
    )
  );
  if (sources.length === 0) return null;

  const storedSteps = (Array.isArray(value.steps) ? value.steps : []).filter(
    (id): id is MigrationStepId => typeof id === 'string' && id in MIGRATION_STEPS
  );
  const steps = STEP_ORDER.filter((stepId) => storedSteps.includes(stepId));
  if (steps.length === 0) return null;

  const outcomes: MigrationJourney['outcomes'] = {};
  const rawOutcomes =
    typeof value.outcomes === 'object' && value.outcomes !== null
      ? (value.outcomes as Record<string, unknown>)
      : {};
  for (const stepId of steps) {
    const outcome = parseOutcome(rawOutcomes[stepId]);
    if (outcome) outcomes[stepId] = outcome;
  }

  const skipped = steps.filter(
    (stepId) => Array.isArray(value.skipped) && value.skipped.includes(stepId) && !outcomes[stepId]
  );

  return {
    version: 1,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : new Date(0).toISOString(),
    sources,
    steps,
    outcomes,
    skipped,
  };
}

function parseOutcome(raw: unknown): MigrationStepOutcome | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const counts: Partial<Record<MigrationCountKey, number>> = {};
  const rawCounts =
    typeof value.counts === 'object' && value.counts !== null
      ? (value.counts as Record<string, unknown>)
      : {};
  for (const key of COUNT_KEYS) {
    const count = rawCounts[key];
    if (typeof count === 'number' && Number.isFinite(count)) counts[key] = count;
  }
  return {
    completedAt:
      typeof value.completedAt === 'string' ? value.completedAt : new Date(0).toISOString(),
    counts,
    errorCount: typeof value.errorCount === 'number' ? value.errorCount : 0,
    warningCount: typeof value.warningCount === 'number' ? value.warningCount : 0,
  };
}

/**
 * Storage is a convenience, never a source of truth: a private window, cleared
 * site data or a browser that blocks storage must leave the wizard usable, so
 * every read and write is wrapped.
 */
export function loadJourney(): MigrationJourney | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(MIGRATION_JOURNEY_STORAGE_KEY);
    if (!stored) return null;
    return parseJourney(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function saveJourney(journey: MigrationJourney): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MIGRATION_JOURNEY_STORAGE_KEY, JSON.stringify(journey));
  } catch {
    // Progress will not survive a reload. The journey still works in this tab.
  }
}

export function clearJourney(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MIGRATION_JOURNEY_STORAGE_KEY);
  } catch {
    // Nothing to do: the next save overwrites whatever is there.
  }
}
