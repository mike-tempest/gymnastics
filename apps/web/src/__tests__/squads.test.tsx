import { Squad } from '@swim-nexus/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { type ReactElement } from 'react';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParamsGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  usePathname: () => '/squads',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// Mock API modules
jest.mock('@/lib/api/squads', () => ({
  getSquads: jest.fn(),
}));

// Import after mocking
import { getSquads } from '@/lib/api/squads';

import SquadsPage from '../app/squads/page';

const mockGetSquads = getSquads as jest.MockedFunction<typeof getSquads>;

const mockSquads = [
  {
    squad_id: 'sq1',
    squad_name: 'Dolphins',
    club_id: 'c1',
    description: 'Beginner squad',
    min_age: 6,
    max_age: 10,
    skill_level: 'Beginner',
    coach_name: 'Coach Davies',
    session_day: 'Monday',
    session_time: '17:00',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    squad_id: 'sq2',
    squad_name: 'Sharks',
    club_id: 'c1',
    description: 'Intermediate squad',
    min_age: 10,
    max_age: 14,
    skill_level: 'Intermediate',
    coach_name: 'Coach Patel',
    session_day: 'Wednesday',
    session_time: '16:30',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
];

// The page renders MainLayout, whose Sidebar resolves the club's
// governing-body label via react-query, so a QueryClient must be present.
function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('SquadsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSquads.mockResolvedValue(mockSquads as unknown as Squad[]);
  });

  it('renders the page heading', async () => {
    renderWithQueryClient(<SquadsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Squads' })).toBeInTheDocument();
    });
  });

  it('renders the squad list', async () => {
    renderWithQueryClient(<SquadsPage />);

    await waitFor(() => {
      expect(screen.getByText('Dolphins')).toBeInTheDocument();
      expect(screen.getByText('Sharks')).toBeInTheDocument();
    });
  });

  it('has an Add Squad button', async () => {
    renderWithQueryClient(<SquadsPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Squad')).toBeInTheDocument();
    });
  });

  it('calls getSquads on mount', async () => {
    renderWithQueryClient(<SquadsPage />);

    await waitFor(() => {
      expect(mockGetSquads).toHaveBeenCalledTimes(1);
    });
  });
});
