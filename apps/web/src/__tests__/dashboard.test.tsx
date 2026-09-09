import { Member, Family, Session } from '@club-manager/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParamsGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  usePathname: () => '/',
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
jest.mock('@/lib/api/members', () => ({
  getMembers: jest.fn(),
}));

jest.mock('@/lib/api/families', () => ({
  getFamilies: jest.fn(),
}));

jest.mock('@/lib/api/sessions', () => ({
  getUpcomingSessions: jest.fn(),
  getRecentSessions: jest.fn(),
}));

jest.mock('@/lib/api/finance', () => ({
  getFinanceDashboard: jest.fn(),
  getOverdueInvoices: jest.fn(),
}));

// useFormatters resolves the club region via getMyClub. Default the mock to a
// GB club so the dashboard renders GB-formatted output.
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: jest.fn().mockResolvedValue({
    id: 'club-1',
    name: 'Whitby Seals',
    country: 'GB',
    currency: 'GBP',
    timezone: 'Europe/London',
    locale: 'en-GB',
  }),
}));

// Import after mocking
import { getFamilies } from '@/lib/api/families';
import {
  getFinanceDashboard,
  getOverdueInvoices,
  FinanceDashboard,
  InvoiceWithDetails,
} from '@/lib/api/finance';
import { getMembers } from '@/lib/api/members';
import { getUpcomingSessions, getRecentSessions } from '@/lib/api/sessions';

import Home from '../app/page';

// The dashboard reads the club region through React Query, so renders need a
// QueryClientProvider. Wrap every render in a fresh client to isolate tests.
function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}

const mockGetMembers = getMembers as jest.MockedFunction<typeof getMembers>;
const mockGetFamilies = getFamilies as jest.MockedFunction<typeof getFamilies>;
const mockGetUpcomingSessions = getUpcomingSessions as jest.MockedFunction<
  typeof getUpcomingSessions
>;
const mockGetRecentSessions = getRecentSessions as jest.MockedFunction<typeof getRecentSessions>;
const mockGetFinanceDashboard = getFinanceDashboard as jest.MockedFunction<
  typeof getFinanceDashboard
>;
const mockGetOverdueInvoices = getOverdueInvoices as jest.MockedFunction<typeof getOverdueInvoices>;

const mockMembers = [
  {
    member_id: 's1',
    family_id: 'f1',
    club_id: 'c1',
    registration_number: 'SE001',
    first_name: 'Emma',
    last_name: 'Watson',
    dob: '2015-03-15',
    gender: 'F',
    squad_id: 'sq1',
    medical_notes: null,
    emergency_contact: null,
    photo_url: null,
    created_at: '2026-02-25T10:00:00Z',
    updated_at: '2026-02-25T10:00:00Z',
  },
  {
    member_id: 's2',
    family_id: 'f2',
    club_id: 'c1',
    registration_number: 'SE002',
    first_name: 'Oliver',
    last_name: 'Taylor',
    dob: '2014-07-22',
    gender: 'M',
    squad_id: 'sq2',
    medical_notes: null,
    emergency_contact: null,
    photo_url: null,
    created_at: '2026-02-24T14:30:00Z',
    updated_at: '2026-02-24T14:30:00Z',
  },
];

const mockFamilies = [
  {
    family_id: 'f1',
    family_name: 'The Watsons',
    primary_contact_name: 'Jane Watson',
    primary_contact_email: 'jane@watsons.com',
    primary_contact_phone: '07700900001',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    family_id: 'f2',
    family_name: 'The Taylors',
    primary_contact_name: 'Mark Taylor',
    primary_contact_email: 'mark@taylors.com',
    primary_contact_phone: '07700900002',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
];

const mockSessions = [
  {
    session_id: 'sess1',
    session_name: 'Monday Squad Training',
    session_date: '2026-03-02',
    start_time: '17:00',
    end_time: '18:00',
    squad_id: 'sq1',
    location: 'Main Pool',
    description: null,
    coach_name: 'Coach Davies',
    max_participants: 20,
    status: 'scheduled',
    attendance_count: 8,
    total_members: 10,
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
    attendance_count: 12,
    total_members: 15,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
];

const mockFinanceDashboard = {
  total_outstanding: 1250.0,
  overdue_count: 2,
  this_month_revenue: 4850.75,
  total_invoices: 25,
  paid_invoices: 18,
  pending_invoices: 5,
  recent_payments: [],
};

const mockOverdueInvoices = [
  {
    invoice_id: 'inv1',
    family_id: 'f1',
    club_id: 'c1',
    total_amount: 75.0,
    status: 'overdue',
    due_date: '2026-02-01',
    created_at: '2026-01-15',
    updated_at: '2026-02-15',
    family: {
      family_id: 'f1',
      family_name: 'The Watsons',
      primary_contact_name: 'Jane Watson',
      primary_contact_email: 'jane@watsons.com',
    },
  },
  {
    invoice_id: 'inv2',
    family_id: 'f2',
    club_id: 'c1',
    total_amount: 50.0,
    status: 'overdue',
    due_date: '2026-02-10',
    created_at: '2026-01-20',
    updated_at: '2026-02-15',
    family: {
      family_id: 'f2',
      family_name: 'The Taylors',
      primary_contact_name: 'Mark Taylor',
      primary_contact_email: 'mark@taylors.com',
    },
  },
];

function setupMocks() {
  mockGetMembers.mockResolvedValue(mockMembers as unknown as Member[]);
  mockGetFamilies.mockResolvedValue(mockFamilies as unknown as Family[]);
  mockGetUpcomingSessions.mockResolvedValue(mockSessions as unknown as Session[]);
  mockGetRecentSessions.mockResolvedValue([]);
  mockGetFinanceDashboard.mockResolvedValue(mockFinanceDashboard as unknown as FinanceDashboard);
  mockGetOverdueInvoices.mockResolvedValue(mockOverdueInvoices as unknown as InvoiceWithDetails[]);
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('renders the page heading', async () => {
    renderWithClient(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });
  });

  // The dashboard renders "Members" twice: once as a primary metric card label
  // and once as a quick-navigation link. The metric card label sits in a plain
  // paragraph, whereas the quick-nav label is inside an anchor, so we can single
  // out the metric card by excluding any match nested in a link.
  function getMembersMetricCard() {
    const membersLabel = screen.getAllByText('Gymnasts').find((el) => el.closest('a') === null);
    expect(membersLabel).toBeDefined();
    return membersLabel!.closest('div');
  }

  it('renders all primary metric cards', async () => {
    renderWithClient(<Home />);

    await waitFor(() => {
      expect(getMembersMetricCard()).toBeInTheDocument();
      expect(screen.getByText('Families')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
    });
  });

  it('displays total members count after loading', async () => {
    renderWithClient(<Home />);

    await waitFor(() => {
      expect(getMembersMetricCard()).toHaveTextContent('2');
    });
  });

  it('displays active families count after loading', async () => {
    renderWithClient(<Home />);

    await waitFor(() => {
      const familiesCard = screen.getByText('Families').closest('div');
      expect(familiesCard).toHaveTextContent('2');
    });
  });

  it('displays upcoming sessions list', async () => {
    renderWithClient(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Upcoming Sessions' })).toBeInTheDocument();
      expect(screen.getByText('Monday Squad Training')).toBeInTheDocument();
      expect(screen.getByText('Wednesday Development')).toBeInTheDocument();
    });
  });

  it('shows recent activity section', async () => {
    renderWithClient(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
    });
  });

  it('displays recently added members in activity feed', async () => {
    renderWithClient(<Home />);

    // The activity feed combines the member name with surrounding copy in a
    // single node (e.g. "Emma Watson joined the club"), so match on a substring.
    await waitFor(() => {
      expect(screen.getByText(/Emma Watson/)).toBeInTheDocument();
      expect(screen.getByText(/Oliver Taylor/)).toBeInTheDocument();
    });
  });

  it('calls all API functions on mount', async () => {
    renderWithClient(<Home />);

    await waitFor(() => {
      expect(mockGetMembers).toHaveBeenCalledTimes(1);
      expect(mockGetFamilies).toHaveBeenCalledTimes(1);
      expect(mockGetUpcomingSessions).toHaveBeenCalledTimes(1);
      expect(mockGetFinanceDashboard).toHaveBeenCalledTimes(1);
      expect(mockGetOverdueInvoices).toHaveBeenCalledTimes(1);
    });
  });
});
