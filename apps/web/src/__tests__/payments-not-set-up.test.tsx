import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/payments',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Parent User', role: 'PARENT', id: 'user1' } },
    status: 'authenticated',
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

jest.mock('@/lib/api/parent', () => ({
  getParentProfile: jest.fn().mockResolvedValue({ family: { family_id: 'f1' } }),
}));

jest.mock('@/lib/hooks', () => ({
  useInvoices: () => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }),
}));

const mockGetActiveByFamily = jest.fn().mockResolvedValue(null);
jest.mock('@/lib/api/mandates', () => ({
  mandatesApi: {
    getActiveByFamily: (...args: unknown[]) => mockGetActiveByFamily(...args),
    startSetup: jest.fn(),
    completeSetup: jest.fn(),
    syncStatus: jest.fn(),
    cancel: jest.fn(),
  },
}));

import PaymentsPage from '../app/payments/page';

const NOT_SET_UP_COPY =
  'Your club has not set up online payments yet. You will be able to add a payment method here once they have. Contact the club if you have questions.';

function renderPage(paymentProvider: 'stripe' | 'gocardless' | null) {
  mockGetMyClub.mockResolvedValue({
    id: 'club-1',
    name: 'Club',
    country: 'GB',
    currency: 'GBP',
    timezone: 'Europe/London',
    locale: 'en-GB',
    payment_provider: paymentProvider,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentsPage />
    </QueryClientProvider>,
  );
}

describe('Payments page settings tab without a payment provider', () => {
  beforeEach(() => {
    mockGetMyClub.mockReset();
  });

  it('shows the informational state instead of setup when payment_provider is null', async () => {
    const user = userEvent.setup();
    renderPage(null);

    await user.click(screen.getByRole('button', { name: 'Payment Settings' }));

    await waitFor(() =>
      expect(screen.getByText(NOT_SET_UP_COPY)).toBeInTheDocument(),
    );
    expect(
      screen.getByText('Online payments are not available yet'),
    ).toBeInTheDocument();

    // The provider info section and setup entry points must not render.
    expect(screen.queryByText(/^About /)).not.toBeInTheDocument();
    expect(screen.queryByText('Payment Information')).not.toBeInTheDocument();
  });

  it('keeps the existing Direct Debit settings content for a GoCardless club', async () => {
    const user = userEvent.setup();
    renderPage('gocardless');

    await user.click(screen.getByRole('button', { name: 'Payment Settings' }));

    await waitFor(() =>
      expect(screen.getByText('About Direct Debit')).toBeInTheDocument(),
    );
    expect(screen.getByText('Payment Information')).toBeInTheDocument();
    expect(screen.queryByText(NOT_SET_UP_COPY)).not.toBeInTheDocument();
  });

  it('keeps the existing Stripe settings content for a Stripe club', async () => {
    const user = userEvent.setup();
    renderPage('stripe');

    await user.click(screen.getByRole('button', { name: 'Payment Settings' }));

    await waitFor(() =>
      expect(screen.getByText('About automatic payments')).toBeInTheDocument(),
    );
    expect(screen.queryByText(NOT_SET_UP_COPY)).not.toBeInTheDocument();
  });
});
