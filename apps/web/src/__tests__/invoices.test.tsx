import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParamsGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  usePathname: () => '/invoices',
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
jest.mock('@/lib/api/finance', () => ({
  getInvoices: jest.fn(),
}));

// The club region call falls back to GB defaults when no region fields are
// present, so the billing page keeps its en-GB currency and date formatting.
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

// Import after mocking
import { getInvoices, InvoiceWithDetails } from '@/lib/api/finance';

// The invoices page is now a redirect; import the billing page directly for testing
import InvoicesPage from '../app/billing/page';

const mockGetInvoices = getInvoices as jest.MockedFunction<typeof getInvoices>;

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockInvoices = [
  {
    invoice_id: 'inv1',
    family_id: 'f1',
    club_id: 'c1',
    total_amount: 75.0,
    status: 'paid',
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
    status: 'pending',
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

describe('InvoicesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInvoices.mockResolvedValue(mockInvoices as unknown as InvoiceWithDetails[]);
    // Bare club payload: no region fields, so useClubRegion resolves to GB defaults.
    mockGetMyClub.mockResolvedValue({ id: 'club-1', name: 'Whitby Seals' });
  });

  it('renders the page heading', async () => {
    renderWithClient(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
    });
  });

  it('renders the invoices list', async () => {
    renderWithClient(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('The Watsons')[0]).toBeInTheDocument();
      expect(screen.getAllByText('The Taylors')[0]).toBeInTheDocument();
    });
  });

  it('has a New Invoice button', async () => {
    renderWithClient(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('New Invoice')).toBeInTheDocument();
    });
  });

  it('calls getInvoices on mount', async () => {
    renderWithClient(<InvoicesPage />);

    await waitFor(() => {
      expect(mockGetInvoices).toHaveBeenCalledTimes(1);
    });
  });

  it('formats invoice amounts in GBP for a UK club', async () => {
    renderWithClient(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('£75.00')[0]).toBeInTheDocument();
      expect(screen.getAllByText('£50.00')[0]).toBeInTheDocument();
    });
  });
});
