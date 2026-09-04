import { Swimmer, Squad } from '@swim-nexus/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParamsGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  usePathname: () => '/swimmers',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockSwimmers = [
  {
    swimmer_id: 's1',
    family_id: 'f1',
    club_id: 'c1',
    se_number: 'SE001',
    first_name: 'Emma',
    last_name: 'Watson',
    dob: '2015-03-15',
    gender: 'F',
    squad_id: 'sq1',
    medical_notes: null,
    emergency_contact: null,
    photo_url: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    swimmer_id: 's2',
    family_id: 'f2',
    club_id: 'c1',
    se_number: 'SE002',
    first_name: 'Oliver',
    last_name: 'Taylor',
    dob: '2014-07-22',
    gender: 'M',
    squad_id: 'sq2',
    medical_notes: null,
    emergency_contact: null,
    photo_url: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    swimmer_id: 's3',
    family_id: 'f3',
    club_id: 'c1',
    se_number: null,
    first_name: 'Lily',
    last_name: 'Evans',
    dob: '2016-11-08',
    gender: 'F',
    squad_id: 'sq1',
    medical_notes: null,
    emergency_contact: null,
    photo_url: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
];

const mockSquads = [
  { squad_id: 'sq1', squad_name: 'Dolphins', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { squad_id: 'sq2', squad_name: 'Sharks', created_at: '2026-01-01', updated_at: '2026-01-01' },
];

// Mock API modules
jest.mock('@/lib/api/swimmers', () => ({
  getSwimmers: jest.fn(),
  getSwimmer: jest.fn(),
  createSwimmer: jest.fn(),
  updateSwimmer: jest.fn(),
  deleteSwimmer: jest.fn(),
}));

jest.mock('@/lib/api/squads', () => ({
  getSquads: jest.fn(),
}));

// Mock the clubs API so useClubRegion (via useFormatters) resolves GB defaults
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

// Import after mocking so we can set return values
import { getSquads } from '@/lib/api/squads';
import { getSwimmers } from '@/lib/api/swimmers';

import SwimmersPage from '../app/swimmers/page';

const mockGetSwimmers = getSwimmers as jest.MockedFunction<typeof getSwimmers>;
const mockGetSquads = getSquads as jest.MockedFunction<typeof getSquads>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('SwimmersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSwimmers.mockResolvedValue(mockSwimmers as unknown as Swimmer[]);
    mockGetSquads.mockResolvedValue(mockSquads as unknown as Squad[]);
    mockGetMyClub.mockRejectedValue(new Error('No club'));
  });

  it('renders the page heading', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Swimmers' })).toBeInTheDocument();
    });
  });

  it('renders the swimmer list', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Emma Watson')).toBeInTheDocument();
      expect(screen.getByText('Oliver Taylor')).toBeInTheDocument();
      expect(screen.getByText('Lily Evans')).toBeInTheDocument();
    });
  });

  it('displays the total swimmers count', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Total Swimmers')).toBeInTheDocument();
    });
  });

  it('has an Add Swimmer button', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Add Swimmer')).toBeInTheDocument();
    });
  });

  it('has an Import CSV link', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Import CSV')).toBeInTheDocument();
    });
  });

  it('filters swimmers by search query', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Emma Watson')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name or registration number...');
    fireEvent.change(searchInput, { target: { value: 'Oliver' } });

    await waitFor(() => {
      expect(screen.getByText('Oliver Taylor')).toBeInTheDocument();
      expect(screen.queryByText('Emma Watson')).not.toBeInTheDocument();
      expect(screen.queryByText('Lily Evans')).not.toBeInTheDocument();
    });
  });

  it('shows a filtered count when searching', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Emma Watson')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name or registration number...');
    fireEvent.change(searchInput, { target: { value: 'Emma' } });

    await waitFor(() => {
      expect(screen.getByText(/Showing 1 of 3/)).toBeInTheDocument();
    });
  });

  it('can search by SE number', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Emma Watson')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name or registration number...');
    fireEvent.change(searchInput, { target: { value: 'SE002' } });

    await waitFor(() => {
      expect(screen.getByText('Oliver Taylor')).toBeInTheDocument();
      expect(screen.queryByText('Emma Watson')).not.toBeInTheDocument();
    });
  });

  it('shows an empty state when no swimmers match the search', async () => {
    render(<SwimmersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Emma Watson')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name or registration number...');
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No swimmers found')).toBeInTheDocument();
    });
  });
});
