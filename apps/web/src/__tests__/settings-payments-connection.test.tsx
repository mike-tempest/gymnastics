import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/admin/settings',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

const mockGetClubSettings = jest.fn();
const mockUpdateClubSettings = jest.fn();
jest.mock('@/lib/api/settings', () => ({
  getClubSettings: (...args: unknown[]) => mockGetClubSettings(...args),
  updateClubSettings: (...args: unknown[]) => mockUpdateClubSettings(...args),
}));

// Bare club payload resolves useClubRegion to GB defaults.
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

const mockGetPaymentConnection = jest.fn();
const mockStartStripeConnect = jest.fn();
const mockSyncStripeConnection = jest.fn();
jest.mock('@/lib/api/payments-connection', () => ({
  getPaymentConnection: (...args: unknown[]) => mockGetPaymentConnection(...args),
  startStripeConnect: (...args: unknown[]) => mockStartStripeConnect(...args),
  syncStripeConnection: (...args: unknown[]) => mockSyncStripeConnection(...args),
}));

// jsdom's window.location is non-configurable, so the card redirects through
// this wrapper module and tests mock it like any other lib module.
const mockRedirectTo = jest.fn();
jest.mock('@/lib/utils/browser-navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args),
}));

import SettingsPage from '../app/admin/settings/page';
import { BRAND } from '../lib/brand';

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const baseSettings = {
  settings_id: 's1',
  club_name: 'Whitby Seals',
  address: null,
  contact_email: null,
  phone: null,
  website: null,
  logo_url: null,
  swim_england: {},
  locations: [],
  billing_config: {},
  notification_prefs: {},
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const emptyCapabilities = {
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  requirements_due: [] as string[],
};

const noneConnection = {
  configured: true,
  provider: null,
  status: 'none',
  livemode: null,
  external_account_id: null,
  capabilities: null,
};

const activeConnection = {
  configured: true,
  provider: 'stripe',
  status: 'active',
  livemode: true,
  external_account_id: 'acct_1NXYZABCD1234',
  capabilities: {
    ...emptyCapabilities,
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
  },
};

/**
 * Sets the current URL. jsdom does not allow mocking window.location, but it
 * does honour same-origin history API changes, which is exactly how the app
 * itself cleans the ?stripe= flag.
 */
function setUrl(path: string) {
  window.history.replaceState(null, '', path);
}

describe('SettingsPage payments connection card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUrl('/admin/settings');
    mockGetMyClub.mockResolvedValue({ id: 'club-1', name: 'Whitby Seals' });
    mockGetClubSettings.mockResolvedValue(baseSettings);
    mockUpdateClubSettings.mockResolvedValue(baseSettings);
  });

  it('shows an operator-level note when the environment is not configured', async () => {
    mockGetPaymentConnection.mockResolvedValue({
      ...noneConnection,
      configured: false,
    });

    renderWithClient(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(`Online payments are not yet enabled on this ${BRAND.name} environment.`)
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Connect with Stripe' })).not.toBeInTheDocument();
  });

  it('offers Connect with Stripe when no account exists and redirects to the onboarding URL', async () => {
    mockGetPaymentConnection.mockResolvedValue(noneConnection);
    mockStartStripeConnect.mockResolvedValue({ url: 'https://connect.stripe.com/setup/s/abc123' });

    const user = userEvent.setup();
    renderWithClient(<SettingsPage />);

    const connectButton = await screen.findByRole('button', { name: 'Connect with Stripe' });
    expect(screen.getByText(/payments from parents go directly to\s+the club/)).toBeInTheDocument();
    expect(
      screen.getByText('Direct Debit via your own GoCardless account is coming soon.')
    ).toBeInTheDocument();

    await user.click(connectButton);

    await waitFor(() => {
      expect(mockStartStripeConnect).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockRedirectTo).toHaveBeenCalledWith('https://connect.stripe.com/setup/s/abc123');
    });
  });

  it('shows the pending state with truncated requirements and both actions', async () => {
    mockGetPaymentConnection.mockResolvedValue({
      configured: true,
      provider: 'stripe',
      status: 'pending',
      livemode: false,
      external_account_id: 'acct_1NXYZABCD1234',
      capabilities: {
        ...emptyCapabilities,
        requirements_due: [
          'business_profile.url',
          'external_account',
          'representative.dob.day',
          'representative.dob.month',
          'representative.dob.year',
          'tos_acceptance.date',
        ],
      },
    });

    renderWithClient(<SettingsPage />);

    expect(await screen.findByText('Setup incomplete')).toBeInTheDocument();
    expect(screen.getByText('business_profile.url')).toBeInTheDocument();
    expect(screen.getByText('external_account')).toBeInTheDocument();
    // Only the first four requirements are listed; the rest collapse.
    expect(screen.queryByText('representative.dob.year')).not.toBeInTheDocument();
    expect(screen.getByText('and 2 more requirements')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue setup with Stripe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh status' })).toBeInTheDocument();
  });

  it('shows the active state with a masked account id and capability ticks', async () => {
    mockGetPaymentConnection.mockResolvedValue(activeConnection);

    renderWithClient(<SettingsPage />);

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('acct_...1234')).toBeInTheDocument();
    expect(screen.getByText('Payments enabled')).toBeInTheDocument();
    expect(screen.getByText('Payouts enabled')).toBeInTheDocument();
    // A live account never shows the test-mode warning.
    expect(screen.queryByText(/Stripe TEST account/)).not.toBeInTheDocument();
  });

  it('warns prominently when the connected account is in test mode', async () => {
    mockGetPaymentConnection.mockResolvedValue({
      ...activeConnection,
      livemode: false,
    });

    renderWithClient(<SettingsPage />);

    expect(
      await screen.findByText('This is a Stripe TEST account - payments will not move real money.')
    ).toBeInTheDocument();
  });

  it('shows a red badge and recovery actions when the account is restricted', async () => {
    mockGetPaymentConnection.mockResolvedValue({
      ...activeConnection,
      status: 'restricted',
      capabilities: { ...emptyCapabilities, requirements_due: ['tos_acceptance.date'] },
    });

    renderWithClient(<SettingsPage />);

    expect(await screen.findByText('Restricted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue setup with Stripe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh status' })).toBeInTheDocument();
  });

  it('auto-syncs once and cleans the query param when returning from Stripe', async () => {
    setUrl('/admin/settings?stripe=return');
    mockGetPaymentConnection.mockResolvedValue({
      ...activeConnection,
      status: 'pending',
      capabilities: { ...emptyCapabilities, requirements_due: ['external_account'] },
    });
    mockSyncStripeConnection.mockResolvedValue(activeConnection);

    renderWithClient(<SettingsPage />);

    await waitFor(() => {
      expect(mockSyncStripeConnection).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Stripe connection is active');
    });
    // The one-shot flag is removed from the URL without a navigation.
    expect(window.location.search).toBe('');
    // The synced payload replaces the cached connection.
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });

  it('does not auto-sync without a stripe query param', async () => {
    mockGetPaymentConnection.mockResolvedValue(activeConnection);

    renderWithClient(<SettingsPage />);

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(mockSyncStripeConnection).not.toHaveBeenCalled();
  });

  it('refreshes the connection status via sync when Refresh status is clicked', async () => {
    mockGetPaymentConnection.mockResolvedValue({
      ...activeConnection,
      status: 'pending',
      capabilities: { ...emptyCapabilities, requirements_due: ['external_account'] },
    });
    mockSyncStripeConnection.mockResolvedValue(activeConnection);

    const user = userEvent.setup();
    renderWithClient(<SettingsPage />);

    const refreshButton = await screen.findByRole('button', { name: 'Refresh status' });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockSyncStripeConnection).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });
});
