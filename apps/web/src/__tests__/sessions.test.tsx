import { Session, Squad } from '@swim-nexus/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParamsGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  usePathname: () => '/sessions',
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
jest.mock('@/lib/api/sessions', () => ({
  getSessions: jest.fn(),
}));

jest.mock('@/lib/api/squads', () => ({
  getSquads: jest.fn(),
}));

// Mock the clubs API so useClubRegion (via useFormatters) resolves GB defaults
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

// Import after mocking
import { getSessions } from '@/lib/api/sessions';
import { getSquads } from '@/lib/api/squads';

import SessionsPage from '../app/sessions/page';

const mockGetSessions = getSessions as jest.MockedFunction<typeof getSessions>;
const mockGetSquads = getSquads as jest.MockedFunction<typeof getSquads>;

const mockSessions = [
  {
    session_id: 'sess1',
    session_name: 'Monday Training',
    session_date: '2026-03-02',
    start_time: '17:00',
    end_time: '18:00',
    squad_id: 'sq1',
    location: 'Main Pool',
    description: null,
    coach_name: 'Coach Davies',
    max_participants: 20,
    status: 'scheduled',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    session_id: 'sess2',
    session_name: 'Wednesday Development',
    session_date: '2026-03-04',
    start_time: '16:30',
    end_time: '17:30',
    squad_id: 'sq2',
    location: 'Training Pool',
    description: null,
    coach_name: 'Coach Patel',
    max_participants: 15,
    status: 'scheduled',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
];

const mockSquads = [
  { squad_id: 'sq1', squad_name: 'Dolphins', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { squad_id: 'sq2', squad_name: 'Sharks', created_at: '2026-01-01', updated_at: '2026-01-01' },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('SessionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessions.mockResolvedValue(mockSessions as unknown as Session[]);
    mockGetSquads.mockResolvedValue(mockSquads as unknown as Squad[]);
    mockGetMyClub.mockRejectedValue(new Error('No club'));
  });

  it('renders the page heading', async () => {
    render(<SessionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument();
    });
  });

  it('renders the sessions list', async () => {
    render(<SessionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Monday Training')).toBeInTheDocument();
      expect(screen.getByText('Wednesday Development')).toBeInTheDocument();
    });
  });

  it('has an Add Session button', async () => {
    render(<SessionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Add Session')).toBeInTheDocument();
    });
  });

  it('calls getSessions on mount', async () => {
    render(<SessionsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockGetSessions).toHaveBeenCalledTimes(1);
    });
  });
});
