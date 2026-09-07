import {
  MIGRATION_JOURNEY_STORAGE_KEY,
  type MigrationJourney,
  clearJourney,
  createJourney,
  currentStepId,
  isJourneyComplete,
  journeyProgress,
  journeyTotals,
  loadJourney,
  orderStepsForSources,
  parseJourney,
  recordStepOutcome,
  reopenStep,
  saveJourney,
  skipStep,
  stepStatus,
  withSources,
} from '../migration-journey';

const outcome = (
  counts: Record<string, number>,
  errorCount = 0,
  warningCount = 0,
  squads?: { created: string[]; matched: string[] }
) => ({
  completedAt: '2026-09-07T09:00:00.000Z',
  counts,
  squads,
  errorCount,
  warningCount,
});

describe('migration journey sequencing', () => {
  it('puts people before money when a club has both a booking tool and GoCardless', () => {
    expect(orderStepsForSources(['gocardless', 'classforkids'])).toEqual([
      'classforkids',
      'fees',
      'gocardless',
    ]);
  });

  it('de-duplicates steps two sources share', () => {
    // Thrive4 and a spreadsheet both feed the members importer and the fees one.
    expect(orderStepsForSources(['thrive4', 'spreadsheet'])).toEqual([
      'squads',
      'members',
      'staff',
      'fees',
    ]);
  });

  it('ignores the order the sources were picked in', () => {
    expect(orderStepsForSources(['gocardless', 'spreadsheet'])).toEqual(
      orderStepsForSources(['spreadsheet', 'gocardless'])
    );
  });

  it('returns no steps for no sources', () => {
    expect(orderStepsForSources([])).toEqual([]);
    expect(isJourneyComplete(createJourney([]))).toBe(false);
  });

  it('drops sources it does not recognise', () => {
    const journey = createJourney(['gocardless', 'myspace' as never, 'gocardless']);
    expect(journey.sources).toEqual(['gocardless']);
    expect(journey.steps).toEqual(['gocardless']);
  });
});

describe('migration journey progress', () => {
  const start = () => createJourney(['spreadsheet', 'gocardless']);

  it('walks the steps in order as each one is recorded', () => {
    let journey = start();
    expect(journey.steps).toEqual(['squads', 'members', 'staff', 'fees', 'gocardless']);
    expect(currentStepId(journey)).toBe('squads');

    journey = recordStepOutcome(
      journey,
      'squads',
      outcome({}, 0, 0, {
        created: ['Recreational', 'Development', 'Performance'],
        matched: [],
      })
    );
    expect(currentStepId(journey)).toBe('members');
    expect(stepStatus(journey, 'squads')).toBe('done');
    expect(stepStatus(journey, 'members')).toBe('current');
    expect(stepStatus(journey, 'gocardless')).toBe('upcoming');
  });

  it('skips optional steps without finishing the journey', () => {
    let journey = skipStep(start(), 'squads');
    expect(stepStatus(journey, 'squads')).toBe('skipped');
    expect(currentStepId(journey)).toBe('members');
    expect(journeyProgress(journey)).toEqual({ settled: 1, total: 5 });

    journey = ['members', 'staff', 'fees', 'gocardless'].reduce(
      (acc, stepId) => skipStep(acc, stepId as never),
      journey
    );
    expect(isJourneyComplete(journey)).toBe(true);
  });

  it('puts a skipped step back and reopens a completed one', () => {
    let journey = skipStep(start(), 'squads');
    journey = reopenStep(journey, 'squads');
    expect(stepStatus(journey, 'squads')).toBe('current');

    journey = recordStepOutcome(
      journey,
      'squads',
      outcome({}, 0, 0, { created: ['Recreational', 'Development'], matched: [] })
    );
    journey = reopenStep(journey, 'squads');
    expect(stepStatus(journey, 'squads')).toBe('current');
    expect(journeyTotals(journey).squadsCreated).toBe(0);
  });

  it('clears a skip when the step is run after all', () => {
    let journey = skipStep(start(), 'staff');
    journey = recordStepOutcome(journey, 'staff', outcome({ staff: 4 }));
    expect(journey.skipped).not.toContain('staff');
    expect(stepStatus(journey, 'staff')).toBe('done');
  });

  it('ignores a step that is not part of this journey', () => {
    const journey = createJourney(['gocardless']);
    expect(recordStepOutcome(journey, 'members', outcome({ members: 9 }))).toBe(journey);
    expect(skipStep(journey, 'members')).toBe(journey);
  });
});

describe('migration journey totals', () => {
  it('adds up what every step reported', () => {
    let journey = createJourney(['spreadsheet', 'gocardless']);
    journey = recordStepOutcome(
      journey,
      'squads',
      outcome({}, 0, 0, { created: ['Recreational', 'Development', 'Performance'], matched: [] })
    );
    journey = recordStepOutcome(
      journey,
      'members',
      outcome({ members: 120, families: 78 }, 2, 0, {
        created: [],
        matched: ['Recreational', 'Development', 'Performance'],
      })
    );
    journey = recordStepOutcome(
      journey,
      'gocardless',
      outcome({ families: 4, mandates: 74, activeMandates: 71 }, 1, 3)
    );

    const totals = journeyTotals(journey);
    expect(totals.counts.members).toBe(120);
    expect(totals.counts.families).toBe(82);
    expect(totals.counts.activeMandates).toBe(71);
    // The three squads were created here and then matched, so they count once.
    expect(totals.squadsCreated).toBe(3);
    expect(totals.squadsMatched).toBe(0);
    expect(totals.errorCount).toBe(3);
    expect(totals.warningCount).toBe(3);
    expect(totals.isEmpty).toBe(false);
  });

  it('counts a squad two people imports both matched only once', () => {
    let journey = createJourney(['classforkids', 'thrive4']);
    journey = recordStepOutcome(
      journey,
      'classforkids',
      outcome({ members: 40 }, 0, 0, { created: ['Tumbling'], matched: ['Pre-school'] })
    );
    journey = recordStepOutcome(
      journey,
      'members',
      outcome({ members: 12 }, 0, 0, { created: [], matched: ['pre-school ', 'Tumbling'] })
    );

    const totals = journeyTotals(journey);
    expect(totals.squadsCreated).toBe(1);
    expect(totals.squadsMatched).toBe(1);
  });

  it('reports an empty migration honestly', () => {
    const journey = recordStepOutcome(
      createJourney(['gocardless']),
      'gocardless',
      outcome({ mandates: 0 }, 5)
    );
    const totals = journeyTotals(journey);
    expect(totals.isEmpty).toBe(true);
    expect(totals.errorCount).toBe(5);
  });
});

describe('changing sources mid-journey', () => {
  it('keeps progress on steps the new sources still need', () => {
    let journey = createJourney(['spreadsheet']);
    journey = recordStepOutcome(journey, 'members', outcome({ members: 10 }));
    journey = skipStep(journey, 'staff');

    const next = withSources(journey, ['spreadsheet', 'gocardless']);
    expect(next.steps).toEqual(['squads', 'members', 'staff', 'fees', 'gocardless']);
    expect(stepStatus(next, 'members')).toBe('done');
    expect(stepStatus(next, 'staff')).toBe('skipped');
  });

  it('drops progress on a step the club no longer needs', () => {
    let journey = createJourney(['spreadsheet', 'gocardless']);
    journey = recordStepOutcome(journey, 'staff', outcome({ staff: 6 }));

    const next = withSources(journey, ['gocardless']);
    expect(next.steps).toEqual(['gocardless']);
    expect(journeyTotals(next).counts.staff).toBe(0);
  });
});

describe('migration journey storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('round-trips through localStorage', () => {
    const journey = recordStepOutcome(
      createJourney(['classforkids']),
      'classforkids',
      outcome({ members: 40, families: 26 }, 1, 2)
    );
    saveJourney(journey);

    const loaded = loadJourney();
    expect(loaded).not.toBeNull();
    expect(loaded?.steps).toEqual(['classforkids', 'fees']);
    expect(loaded?.outcomes.classforkids?.counts.members).toBe(40);
    expect(loaded?.outcomes.classforkids?.warningCount).toBe(2);

    clearJourney();
    expect(loadJourney()).toBeNull();
  });

  it('returns null rather than throwing when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(loadJourney()).toBeNull();
  });

  it('swallows a failed write so the journey still works in this tab', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveJourney(createJourney(['gocardless']))).not.toThrow();
  });

  it('ignores stored JSON that is not a journey', () => {
    window.localStorage.setItem(MIGRATION_JOURNEY_STORAGE_KEY, 'not json at all');
    expect(loadJourney()).toBeNull();
  });

  it('drops unknown steps and outcomes when reading storage back', () => {
    const stored = {
      version: 1,
      startedAt: '2026-09-07T09:00:00.000Z',
      sources: ['gocardless'],
      steps: ['gocardless', 'competitions'],
      outcomes: {
        gocardless: {
          completedAt: 'x',
          counts: { mandates: 12, moons: 3 },
          squads: { created: ['Tumbling', 7], matched: 'all of them' },
          errorCount: 'lots',
        },
        competitions: { completedAt: 'x', counts: { members: 5 }, errorCount: 0 },
      },
      skipped: ['competitions'],
    };
    const parsed = parseJourney(stored) as MigrationJourney;

    expect(parsed.steps).toEqual(['gocardless']);
    expect(parsed.outcomes.gocardless?.counts).toEqual({ mandates: 12 });
    expect(parsed.outcomes.gocardless?.squads).toEqual({ created: ['Tumbling'], matched: [] });
    expect(parsed.outcomes.gocardless?.errorCount).toBe(0);
    expect(parsed.skipped).toEqual([]);
  });

  it('keeps the step order a journey was started with', () => {
    // A future release could reorder the catalogue; a club halfway through a
    // migration keeps the sequence it was shown.
    const parsed = parseJourney({
      version: 1,
      startedAt: '2026-09-07T09:00:00.000Z',
      sources: ['spreadsheet'],
      steps: ['fees', 'members', 'squads'],
      outcomes: {},
      skipped: [],
    });
    expect(parsed?.steps).toEqual(['fees', 'members', 'squads']);
  });

  it('rejects a journey from a future version', () => {
    expect(parseJourney({ version: 2, sources: ['gocardless'], steps: ['gocardless'] })).toBeNull();
  });
});
