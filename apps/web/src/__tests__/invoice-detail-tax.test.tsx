import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';

// Mock next/navigation. The detail page reads the invoice id from route params;
// MainLayout's sidebar reads the current pathname.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ id: 'inv-tax' }),
  usePathname: () => '/billing/inv-tax',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockGetInvoice = jest.fn();
jest.mock('@/lib/api/finance', () => ({
  getInvoice: (...args: unknown[]) => mockGetInvoice(...args),
  updateInvoice: jest.fn(),
  deleteInvoice: jest.fn(),
  sendInvoiceReminder: jest.fn(),
  createPayment: jest.fn(),
}));

// Bare club payload resolves useClubRegion to GB defaults (GBP, en-GB).
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

import BillingInvoiceDetailPage from '../app/billing/[id]/page';

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const baseInvoice = {
  invoice_id: 'inv-tax',
  family_id: 'f1',
  invoice_number: 'INV-001',
  subtotal: 100.0,
  total_amount: 100.0,
  tax_amount: 0,
  status: 'sent',
  due_date: '2026-02-01',
  created_at: '2026-01-15',
  updated_at: '2026-01-15',
  family: {
    family_id: 'f1',
    family_name: 'The Watsons',
    primary_contact_name: 'Jane Watson',
    primary_contact_email: 'jane@watsons.com',
  },
  items: [
    {
      item_id: 'it1',
      invoice_id: 'inv-tax',
      description: 'Term fees',
      unit_price: 100.0,
      quantity: 1,
      total: 100.0,
    },
  ],
  payments: [],
};

describe('BillingInvoiceDetailPage tax rows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyClub.mockResolvedValue({ id: 'club-1', name: 'Whitby Seals' });
  });

  it('hides tax rows when tax_amount is zero', async () => {
    mockGetInvoice.mockResolvedValue(baseInvoice);

    renderWithClient(<BillingInvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Total:')[0]).toBeInTheDocument();
    });

    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument();
    expect(screen.queryByText('VAT')).not.toBeInTheDocument();
  });

  it('shows subtotal and the tax label when tax_amount is positive', async () => {
    mockGetInvoice.mockResolvedValue({
      ...baseInvoice,
      subtotal: 100.0,
      tax_amount: 20.0,
      total_amount: 120.0,
      tax_label: 'VAT',
    });

    renderWithClient(<BillingInvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Subtotal')[0]).toBeInTheDocument();
    });

    expect(screen.getAllByText('VAT')[0]).toBeInTheDocument();
    expect(screen.getAllByText('£20.00')[0]).toBeInTheDocument();
  });

  it('falls back to a neutral Tax label when tax_label is absent', async () => {
    mockGetInvoice.mockResolvedValue({
      ...baseInvoice,
      subtotal: 100.0,
      tax_amount: 20.0,
      total_amount: 120.0,
    });

    renderWithClient(<BillingInvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Tax')[0]).toBeInTheDocument();
    });
  });
});
