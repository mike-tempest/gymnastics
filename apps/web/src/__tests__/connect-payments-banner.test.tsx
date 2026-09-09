import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetPaymentConnection = jest.fn();
jest.mock('@/lib/api/payments-connection', () => ({
  getPaymentConnection: (...args: unknown[]) => mockGetPaymentConnection(...args),
}));

import ConnectPaymentsBanner from '@/components/billing/ConnectPaymentsBanner';

const emptyCapabilities = {
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  requirements_due: [] as string[],
};

function connection(status: string, configured = true) {
  return {
    configured,
    provider: status === 'none' ? null : 'stripe',
    status,
    livemode: status === 'none' ? null : true,
    external_account_id: status === 'none' ? null : 'acct_123',
    capabilities: status === 'none' ? null : emptyCapabilities,
  };
}

function renderBanner() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConnectPaymentsBanner />
    </QueryClientProvider>
  );
}

const BANNER_COPY = "Connect your club's Stripe account to collect payments automatically.";

describe('ConnectPaymentsBanner', () => {
  beforeEach(() => {
    mockGetPaymentConnection.mockReset();
    window.sessionStorage.clear();
  });

  it('nudges towards payment settings when the club has never connected', async () => {
    mockGetPaymentConnection.mockResolvedValue(connection('none'));

    renderBanner();

    expect(await screen.findByText(BANNER_COPY)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Go to payment settings' });
    expect(link).toHaveAttribute('href', '/admin/settings#payments');
  });

  it('shows for a connection that exists but is not active yet', async () => {
    mockGetPaymentConnection.mockResolvedValue(connection('pending'));

    renderBanner();

    expect(await screen.findByText(BANNER_COPY)).toBeInTheDocument();
  });

  it('renders nothing when the connection is active', async () => {
    mockGetPaymentConnection.mockResolvedValue(connection('active'));

    renderBanner();

    await waitFor(() => expect(mockGetPaymentConnection).toHaveBeenCalled());
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument();
  });

  it('renders nothing when the platform has no Stripe configuration', async () => {
    // Local environments without platform keys have nothing to connect to, so
    // the nudge would be a dead end.
    mockGetPaymentConnection.mockResolvedValue(connection('none', false));

    renderBanner();

    await waitFor(() => expect(mockGetPaymentConnection).toHaveBeenCalled());
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument();
  });

  it('renders nothing when the connection state cannot be loaded', async () => {
    mockGetPaymentConnection.mockRejectedValue(new Error('403'));

    renderBanner();

    await waitFor(() => expect(mockGetPaymentConnection).toHaveBeenCalled());
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument();
  });

  it('dismisses for the rest of the session', async () => {
    mockGetPaymentConnection.mockResolvedValue(connection('none'));
    const user = userEvent.setup();

    renderBanner();

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument();

    // A remount within the same session stays dismissed.
    renderBanner();
    await waitFor(() => expect(mockGetPaymentConnection).toHaveBeenCalled());
    expect(screen.queryByText(BANNER_COPY)).not.toBeInTheDocument();
  });
});
