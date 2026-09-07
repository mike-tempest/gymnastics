import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import MigrationJourneyPage from '@/app/admin/import/migration/page';
import ImportHubPage from '@/app/admin/import/page';
import {
  MIGRATION_JOURNEY_STORAGE_KEY,
  createJourney,
  recordStepOutcome,
  saveJourney,
} from '@/lib/import/migration-journey';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/admin/import',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function storedJourney() {
  const raw = window.localStorage.getItem(MIGRATION_JOURNEY_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('Migration wizard entry step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('asks where the club data lives and sequences the sources it is given', () => {
    render(<ImportHubPage />);

    expect(
      screen.getByRole('heading', { name: /Where is your club's data today\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/no single customer export and no API/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start migration/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /GoCardless/ }));
    fireEvent.click(screen.getByRole('button', { name: /ClassForKids/ }));

    // People before money, whichever order the club picked the sources in.
    const journey = screen.getByRole('list');
    const steps = within(journey)
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(steps[0]).toContain('ClassForKids spreadsheets');
    expect(steps[steps.length - 1]).toContain('GoCardless takeover');
    expect(screen.getByText(/comes last on purpose/)).toBeInTheDocument();
  });

  it('saves the journey and opens it when the club starts', () => {
    render(<ImportHubPage />);

    fireEvent.click(screen.getByRole('button', { name: /Spreadsheets or form responses/ }));
    fireEvent.click(screen.getByRole('button', { name: /Start migration/ }));

    expect(storedJourney()).toMatchObject({
      version: 1,
      sources: ['spreadsheet'],
      steps: ['squads', 'members', 'staff', 'fees'],
    });
    expect(mockPush).toHaveBeenCalledWith('/admin/import/migration');
  });

  it('offers to resume a journey saved earlier', () => {
    saveJourney(createJourney(['gocardless', 'spreadsheet']));

    render(<ImportHubPage />);

    expect(screen.getByText(/You have a migration in progress/)).toBeInTheDocument();
    expect(screen.getByText(/0 of 5 steps done/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue migration/ })).toHaveAttribute(
      'href',
      '/admin/import/migration'
    );
  });

  it('adds a source to a journey in progress without losing what it imported', async () => {
    let journey = createJourney(['spreadsheet']);
    journey = recordStepOutcome(journey, 'members', {
      completedAt: '2026-09-07T09:00:00.000Z',
      counts: { members: 60 },
      errorCount: 0,
      warningCount: 0,
    });
    saveJourney(journey);

    render(<ImportHubPage />);

    // The club's own sources come back ticked, so this is an edit, not a restart.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Spreadsheets or form responses/ })
      ).toHaveAttribute('aria-pressed', 'true')
    );

    fireEvent.click(screen.getByRole('button', { name: /GoCardless/ }));
    fireEvent.click(screen.getByRole('button', { name: /Update your journey/ }));

    const saved = storedJourney();
    expect(saved.sources).toEqual(['spreadsheet', 'gocardless']);
    expect(saved.steps).toContain('gocardless');
    expect(saved.outcomes.members.counts.members).toBe(60);
  });

  it('forgets the journey when the club starts again', () => {
    saveJourney(createJourney(['gocardless']));

    render(<ImportHubPage />);
    fireEvent.click(screen.getByRole('button', { name: /Start again/ }));

    expect(storedJourney()).toBeNull();
    expect(screen.queryByText(/You have a migration in progress/)).not.toBeInTheDocument();
  });
});

describe('Migration journey page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('sends a club with nothing saved back to the source picker', () => {
    render(<MigrationJourneyPage />);

    expect(screen.getByRole('heading', { name: /No migration in progress/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Choose your sources/ })).toHaveAttribute(
      'href',
      '/admin/import'
    );
  });

  it('points at the current step and links to its importer', () => {
    saveJourney(createJourney(['spreadsheet', 'gocardless']));

    render(<MigrationJourneyPage />);

    expect(screen.getByText('0 of 5 steps done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start this step/ })).toHaveAttribute(
      'href',
      '/admin/import/squads'
    );
  });

  it('resumes at the step after the ones already imported', () => {
    let journey = createJourney(['spreadsheet', 'gocardless']);
    journey = recordStepOutcome(journey, 'squads', {
      completedAt: '2026-09-07T09:00:00.000Z',
      counts: {},
      squads: { created: ['Recreational', 'Development', 'Performance', 'Tumbling'], matched: [] },
      errorCount: 0,
      warningCount: 0,
    });
    saveJourney(journey);

    render(<MigrationJourneyPage />);

    expect(screen.getByText('1 of 5 steps done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start this step/ })).toHaveAttribute(
      'href',
      '/admin/import/members'
    );
    expect(screen.getByRole('button', { name: /Run again/ })).toBeInTheDocument();
  });

  it('skips an optional step and remembers the skip', () => {
    saveJourney(createJourney(['spreadsheet']));

    render(<MigrationJourneyPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /Skip/ })[0]);

    expect(storedJourney().skipped).toEqual(['squads']);
    expect(screen.getByText('1 of 4 steps done')).toBeInTheDocument();
  });

  it('shows the finish checklist with what came across once every step is settled', () => {
    let journey = createJourney(['spreadsheet', 'gocardless']);
    journey = recordStepOutcome(journey, 'members', {
      completedAt: '2026-09-07T09:00:00.000Z',
      counts: { members: 118, families: 74 },
      squads: { created: ['Tumbling', 'Trampoline'], matched: ['Recreational'] },
      errorCount: 3,
      warningCount: 0,
    });
    journey = recordStepOutcome(journey, 'gocardless', {
      completedAt: '2026-09-07T09:30:00.000Z',
      counts: { families: 2, mandates: 70, activeMandates: 68 },
      errorCount: 0,
      warningCount: 1,
    });
    journey = { ...journey, skipped: ['squads', 'staff', 'fees'] };
    saveJourney(journey);

    render(<MigrationJourneyPage />);

    expect(screen.getByRole('heading', { name: /Your migration is done/ })).toBeInTheDocument();
    expect(screen.getByText('118')).toBeInTheDocument();
    expect(screen.getByText('76')).toBeInTheDocument(); // families from both steps
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText(/3 rows could not be imported/)).toBeInTheDocument();
    expect(screen.getByText('Squads created').previousElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Squads matched').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: /Go to families/ })).toHaveAttribute(
      'href',
      '/families'
    );
    expect(screen.getByText(/Connect GoCardless so collections run/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to compliance/ })).toHaveAttribute(
      'href',
      '/compliance'
    );
  });

  it('says so plainly when every step was skipped', () => {
    const journey = createJourney(['spreadsheet']);
    saveJourney({ ...journey, skipped: ['squads', 'members', 'staff', 'fees'] });

    render(<MigrationJourneyPage />);

    expect(screen.getByText(/Nothing has been imported yet/)).toBeInTheDocument();
    expect(screen.getByText(/Set up Direct Debits/)).toBeInTheDocument();
  });
});
