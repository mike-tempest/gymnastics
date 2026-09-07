import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ReactElement } from 'react';

// The club lookup behind useFormatters, so dates render on GB defaults with
// no real network call.
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: jest.fn().mockRejectedValue(new Error('no club')),
}));

// Import after mocking
import BadgeProgress from '@/components/members/BadgeProgress';
import { BadgeLadder, BadgeLadderLevel } from '@/lib/api/awards';

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function level(overrides: Partial<BadgeLadderLevel> & { level_id: string; name: string }) {
  return {
    description: null,
    sort_order: 1,
    status: null,
    started_on: null,
    assessed_on: null,
    awarded_on: null,
    ...overrides,
  } satisfies BadgeLadderLevel;
}

const discover1 = level({
  level_id: 'level-1',
  name: 'Discover 1',
  sort_order: 1,
  status: 'awarded',
  started_on: '2026-01-05',
  assessed_on: '2026-02-10',
  awarded_on: '2026-02-10',
});

const discover2 = level({
  level_id: 'level-2',
  name: 'Discover 2',
  sort_order: 2,
  status: 'working_towards',
  started_on: '2026-02-11',
});

const explore1 = level({ level_id: 'level-3', name: 'Explore 1', sort_order: 3 });

const riseLadder: BadgeLadder = {
  schemes: [
    {
      scheme_id: 'scheme-1',
      name: 'British Gymnastics Rise',
      description: 'Discover, Explore and Excel.',
      levels: [discover1, discover2, explore1],
      awarded_count: 1,
      current_level: discover2,
      latest_award: discover1,
    },
  ],
  total_awarded: 1,
  latest_award: { ...discover1, scheme_name: 'British Gymnastics Rise' },
};

describe('BadgeProgress (TEM-21)', () => {
  it('renders every level on the ladder with its status and dates', () => {
    renderWithProviders(<BadgeProgress badges={riseLadder} memberName="Emma" />);

    expect(screen.getByText('British Gymnastics Rise')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 awarded')).toBeInTheDocument();

    // Twice: once in the latest-award banner, once on the ladder itself.
    expect(screen.getAllByText('Discover 1')).toHaveLength(2);
    expect(screen.getByText('Awarded 10 Feb 2026')).toBeInTheDocument();

    expect(screen.getByText('Discover 2')).toBeInTheDocument();
    expect(screen.getByText('Working towards since 11 Feb 2026')).toBeInTheDocument();

    expect(screen.getByText('Explore 1')).toBeInTheDocument();
    expect(screen.getByText('Still to come')).toBeInTheDocument();
  });

  it('leads with the most recent award across every scheme', () => {
    renderWithProviders(<BadgeProgress badges={riseLadder} memberName="Emma" />);

    expect(screen.getByText(/awarded on/)).toBeInTheDocument();
    expect(screen.getAllByText('Discover 1').length).toBeGreaterThan(0);
  });

  it('names the gymnast while nothing has been awarded yet', () => {
    const untouched: BadgeLadder = {
      schemes: [
        {
          scheme_id: 'scheme-1',
          name: 'British Gymnastics Rise',
          description: null,
          levels: [level({ level_id: 'level-1', name: 'Discover 1' })],
          awarded_count: 0,
          current_level: level({ level_id: 'level-1', name: 'Discover 1' }),
          latest_award: null,
        },
      ],
      total_awarded: 0,
      latest_award: null,
    };

    renderWithProviders(<BadgeProgress badges={untouched} memberName="Emma" />);

    expect(screen.getByText(/No badges awarded yet/)).toBeInTheDocument();
    expect(screen.getByText(/Emma is working towards/)).toBeInTheDocument();
    expect(screen.getByText('Working towards')).toBeInTheDocument();
  });

  it('falls back to the display noun when no name is given', () => {
    renderWithProviders(
      <BadgeProgress badges={{ ...riseLadder, total_awarded: 0, latest_award: null }} />
    );

    expect(screen.getByText(/this gymnast is working towards/)).toBeInTheDocument();
  });

  it('shows an assessed badge as awaiting its result', () => {
    const assessed: BadgeLadder = {
      schemes: [
        {
          scheme_id: 'scheme-1',
          name: 'British Gymnastics Rise',
          description: null,
          levels: [
            level({
              level_id: 'level-1',
              name: 'Discover 1',
              status: 'assessed',
              assessed_on: '2026-03-01',
            }),
          ],
          awarded_count: 0,
          current_level: level({ level_id: 'level-1', name: 'Discover 1', status: 'assessed' }),
          latest_award: null,
        },
      ],
      total_awarded: 0,
      latest_award: null,
    };

    renderWithProviders(<BadgeProgress badges={assessed} />);

    expect(screen.getByText('Assessed 1 Mar 2026, result to follow')).toBeInTheDocument();
  });

  it('shows a loading line while the ladder is on its way', () => {
    renderWithProviders(<BadgeProgress badges={null} isLoading />);

    expect(screen.getByText('Loading badge progress...')).toBeInTheDocument();
  });

  it('shows the error rather than an empty state when the call failed', () => {
    renderWithProviders(<BadgeProgress badges={null} error="Could not load badge progress." />);

    expect(screen.getByText('Could not load badge progress.')).toBeInTheDocument();
    expect(screen.queryByText('No badge scheme yet')).not.toBeInTheDocument();
  });

  it('explains the empty state when the club runs no scheme yet', () => {
    renderWithProviders(
      <BadgeProgress badges={{ schemes: [], total_awarded: 0, latest_award: null }} />
    );

    expect(screen.getByText('No badge scheme yet')).toBeInTheDocument();
  });
});
