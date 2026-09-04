import { Family } from '@swim-nexus/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { type ReactElement } from 'react';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParamsGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  usePathname: () => '/families',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockFamilies = [
  {
    family_id: 'f1',
    family_name: 'The Smiths',
    primary_contact_name: 'John Smith',
    primary_contact_email: 'john@smiths.com',
    primary_contact_phone: '07700900001',
    city: 'Manchester',
    postcode: 'M1 1AA',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    swimmers: [
      { swimmer_id: 's1', first_name: 'Alice', last_name: 'Smith' },
    ],
  },
  {
    family_id: 'f2',
    family_name: 'The Joneses',
    primary_contact_name: 'Sarah Jones',
    primary_contact_email: 'sarah@jones.com',
    primary_contact_phone: null,
    city: 'London',
    postcode: 'SW1A 1AA',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    swimmers: [
      { swimmer_id: 's2', first_name: 'Bob', last_name: 'Jones' },
      { swimmer_id: 's3', first_name: 'Carol', last_name: 'Jones' },
    ],
  },
  {
    family_id: 'f3',
    family_name: 'The Greens',
    primary_contact_name: 'David Green',
    primary_contact_email: 'david@green.com',
    primary_contact_phone: null,
    city: null,
    postcode: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    swimmers: [],
  },
];

// Mock API modules
jest.mock('@/lib/api/families', () => ({
  getFamilies: jest.fn(),
  getFamily: jest.fn(),
  createFamily: jest.fn(),
  updateFamily: jest.fn(),
  acceptInvite: jest.fn(),
}));

import { getFamilies } from '@/lib/api/families';

import FamiliesPage from '../app/families/page';

const mockGetFamilies = getFamilies as jest.MockedFunction<typeof getFamilies>;

// The page renders MainLayout, whose Sidebar resolves the club's
// governing-body label via react-query, so a QueryClient must be present.
function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('FamiliesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFamilies.mockResolvedValue(mockFamilies as unknown as Family[]);
  });

  it('renders the page heading', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Families' })).toBeInTheDocument();
    });
  });

  it('renders the families list', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument();
      expect(screen.getByText('The Joneses')).toBeInTheDocument();
      expect(screen.getByText('The Greens')).toBeInTheDocument();
    });
  });

  it('renders each family as a link to its detail page', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument();
    });

    const smithsLink = screen.getByText('The Smiths').closest('a');
    expect(smithsLink).toHaveAttribute('href', '/families/f1');

    const jonesesLink = screen.getByText('The Joneses').closest('a');
    expect(jonesesLink).toHaveAttribute('href', '/families/f2');
  });

  it('displays contact information for each family', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText(/John Smith/)).toBeInTheDocument();
      expect(screen.getByText(/john@smiths.com/)).toBeInTheDocument();
      expect(screen.getByText(/Sarah Jones/)).toBeInTheDocument();
    });
  });

  it('displays city and postcode when available', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Manchester, M1 1AA')).toBeInTheDocument();
      expect(screen.getByText('London, SW1A 1AA')).toBeInTheDocument();
    });
  });

  it('displays the Total Families stat', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Families')).toBeInTheDocument();
    });
  });

  it('has an Add Family button', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Family')).toBeInTheDocument();
    });
  });

  it('filters families by search query', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.change(searchInput, { target: { value: 'Jones' } });

    await waitFor(() => {
      expect(screen.getByText('The Joneses')).toBeInTheDocument();
      expect(screen.queryByText('The Smiths')).not.toBeInTheDocument();
      expect(screen.queryByText('The Greens')).not.toBeInTheDocument();
    });
  });

  it('can search by email address', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.change(searchInput, { target: { value: 'david@green' } });

    await waitFor(() => {
      expect(screen.getByText('The Greens')).toBeInTheDocument();
      expect(screen.queryByText('The Smiths')).not.toBeInTheDocument();
    });
  });

  it('shows an empty state when no families match the search', async () => {
    renderWithQueryClient(<FamiliesPage />);

    await waitFor(() => {
      expect(screen.getByText('The Smiths')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No families found')).toBeInTheDocument();
    });
  });
});
