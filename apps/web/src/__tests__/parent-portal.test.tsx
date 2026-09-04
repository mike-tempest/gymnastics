import { Swimmer, Session } from '@swim-nexus/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParamsGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  usePathname: () => '/parent',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Parent User', role: 'PARENT', id: 'user1' } }, status: 'authenticated' }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// Mock API modules
jest.mock('@/lib/api/parent', () => ({
  fetchParentDashboard: jest.fn(),
  fetchParentSwimmers: jest.fn(),
  fetchParentInvoices: jest.fn(),
  fetchParentUpcomingSessions: jest.fn(),
}));

// Mock the club lookup that useFormatters/useClubRegion depend on so the
// portal renders with GB defaults (GBP, en-GB) and no real network call.
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: jest.fn().mockRejectedValue(new Error('no club')),
}));

// Import after mocking
import { InvoiceWithDetails } from '@/lib/api/finance';
import {
  fetchParentDashboard,
  fetchParentSwimmers,
  fetchParentInvoices,
  fetchParentUpcomingSessions,
  ParentDashboardSummary,
} from '@/lib/api/parent';

import ParentPortalPage from '../app/parent/page';

const mockFetchParentDashboard = fetchParentDashboard as jest.MockedFunction<typeof fetchParentDashboard>;
const mockFetchParentSwimmers = fetchParentSwimmers as jest.MockedFunction<typeof fetchParentSwimmers>;
const mockFetchParentInvoices = fetchParentInvoices as jest.MockedFunction<typeof fetchParentInvoices>;
const mockFetchParentUpcomingSessions = fetchParentUpcomingSessions as jest.MockedFunction<typeof fetchParentUpcomingSessions>;

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const mockDashboard = {
  familyName: 'The Watsons',
  childrenCount: 1,
  upcomingSessionsCount: 1,
  outstandingBalance: 75.0,
};

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
];

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
];

const mockInvoices = [
  {
    invoice_id: 'inv1',
    family_id: 'f1',
    club_id: 'c1',
    total_amount: 75.0,
    status: 'pending',
    due_date: '2026-02-01',
    created_at: '2026-01-15',
    updated_at: '2026-02-15',
  },
  {
    invoice_id: 'inv2',
    invoice_number: 'INV-0002',
    family_id: 'f1',
    club_id: 'c1',
    total_amount: 120.0,
    currency: 'USD',
    status: 'paid',
    due_date: '2026-01-20',
    created_at: '2026-01-05',
    updated_at: '2026-01-18',
  },
];

describe('ParentPortalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchParentDashboard.mockResolvedValue(mockDashboard as unknown as ParentDashboardSummary);
    mockFetchParentSwimmers.mockResolvedValue(mockSwimmers as unknown as Swimmer[]);
    mockFetchParentUpcomingSessions.mockResolvedValue(mockSessions as unknown as Session[]);
    mockFetchParentInvoices.mockResolvedValue(mockInvoices as unknown as InvoiceWithDetails[]);
  });

  it('renders the page heading', async () => {
    renderWithProviders(<ParentPortalPage />);

    await waitFor(() => {
      expect(screen.getByText(/Parent Portal/i)).toBeInTheDocument();
    });
  });

  it('displays welcome message', async () => {
    renderWithProviders(<ParentPortalPage />);

    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });
  });

  it('displays children', async () => {
    renderWithProviders(<ParentPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Emma Watson')).toBeInTheDocument();
    });
  });

  it('displays upcoming sessions', async () => {
    renderWithProviders(<ParentPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Monday Training')).toBeInTheDocument();
    });
  });

  it('calls all API functions on mount', async () => {
    renderWithProviders(<ParentPortalPage />);

    await waitFor(() => {
      expect(mockFetchParentDashboard).toHaveBeenCalledTimes(1);
      expect(mockFetchParentSwimmers).toHaveBeenCalledTimes(1);
      expect(mockFetchParentUpcomingSessions).toHaveBeenCalledTimes(1);
      expect(mockFetchParentInvoices).toHaveBeenCalledTimes(1);
    });
  });

  it('formats outstanding amounts as GBP by default', async () => {
    renderWithProviders(<ParentPortalPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/£75\.00/).length).toBeGreaterThan(0);
    });
  });

  it('honours the invoice currency override in recent activity', async () => {
    renderWithProviders(<ParentPortalPage />);

    // The paid invoice carries currency USD; under the GB fallback locale
    // it must render as US$120.00, proving invoice.currency is threaded
    // through to formatCurrency rather than the club default.
    await waitFor(() => {
      expect(screen.getByText(/INV-0002 for US\$120\.00/)).toBeInTheDocument();
    });
  });
});
