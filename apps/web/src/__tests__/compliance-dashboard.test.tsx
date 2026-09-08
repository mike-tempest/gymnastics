import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';

// The compliance dashboard used to show every officer's check as "Valid"
// regardless of the expiry date beside it, and only ever surfaced the first
// officer. Both are safeguarding-relevant, so both are asserted here.

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/compliance',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Gemma Laird', role: 'welfare_officer' } },
    status: 'authenticated',
  }),
  signOut: jest.fn(),
}));

const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

jest.mock('@/lib/api/compliance', () => ({
  getComplianceSummary: jest.fn(),
}));

import ComplianceDashboardPage from '@/app/compliance/page';
import {
  getComplianceSummary,
  type ComplianceSummary,
  type SafeguardingOfficerSummary,
} from '@/lib/api/compliance';

const mockGetSummary = getComplianceSummary as jest.MockedFunction<typeof getComplianceSummary>;

function officer(overrides: Partial<SafeguardingOfficerSummary> = {}): SafeguardingOfficerSummary {
  return {
    name: 'Gemma Laird',
    role: 'Welfare Officer',
    email: 'gemma.laird@example.org',
    phone: '07700 900109',
    dbsNumber: '001234567892',
    dbsExpiry: '2027-10-02T00:00:00.000Z',
    daysRemaining: 400,
    checkStatus: 'valid',
    ...overrides,
  };
}

function summary(overrides: Partial<ComplianceSummary> = {}): ComplianceSummary {
  return {
    healthScore: 72,
    totalMembers: 40,
    dbsValid: 8,
    dbsExpiringSoon: 1,
    dbsExpired: 0,
    consentComplete: 30,
    consentPartial: 8,
    consentMissing: 2,
    safeguardingOfficer: officer(),
    safeguardingOfficers: [officer()],
    expiringDbsChecks: [],
    ...overrides,
  };
}

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<ComplianceDashboardPage />, { wrapper: Wrapper });
}

describe('ComplianceDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyClub.mockResolvedValue({ id: 'club-1', name: 'Demo Gym', country: 'GB' });
  });

  /** The officer's own card, found by the name it is labelled with. */
  async function officerCard(name: string): Promise<HTMLElement> {
    return await screen.findByRole('article', { name });
  }

  it('shows the consent figures the service reports', async () => {
    mockGetSummary.mockResolvedValue(summary());

    renderPage();
    const consentCard = (await screen.findByText('Consent status')).closest('a') as HTMLElement;

    expect(within(consentCard).getByText('30')).toBeInTheDocument();
    expect(within(consentCard).getByText('8')).toBeInTheDocument();
    expect(within(consentCard).getByText('2')).toBeInTheDocument();
  });

  it('reports an expired officer check as expired, not valid', async () => {
    const lapsed = officer({ daysRemaining: -12, checkStatus: 'expired' });
    mockGetSummary.mockResolvedValue(
      summary({ safeguardingOfficer: lapsed, safeguardingOfficers: [lapsed] })
    );

    renderPage();
    const card = await officerCard('Gemma Laird');

    expect(within(card).getByText('Expired')).toBeInTheDocument();
    expect(within(card).queryByText('Valid')).not.toBeInTheDocument();
  });

  it('counts down an officer check that is close to expiry', async () => {
    const expiring = officer({ daysRemaining: 24, checkStatus: 'expiring' });
    mockGetSummary.mockResolvedValue(
      summary({ safeguardingOfficer: expiring, safeguardingOfficers: [expiring] })
    );

    renderPage();
    const card = await officerCard('Gemma Laird');

    expect(within(card).getByText('24 days remaining')).toBeInTheDocument();
  });

  it('does not claim a check is valid when no expiry is recorded', async () => {
    const withoutExpiry = officer({ dbsExpiry: '', daysRemaining: null, checkStatus: 'unknown' });
    mockGetSummary.mockResolvedValue(
      summary({ safeguardingOfficer: withoutExpiry, safeguardingOfficers: [withoutExpiry] })
    );

    renderPage();
    const card = await officerCard('Gemma Laird');

    expect(within(card).getByText('No expiry recorded')).toBeInTheDocument();
    expect(within(card).queryByText('Valid')).not.toBeInTheDocument();
  });

  it('lists every safeguarding officer, not only the first', async () => {
    const deputy = officer({
      name: 'Aled Prosser',
      role: 'Deputy Welfare Officer',
      email: 'aled.prosser@example.org',
      daysRemaining: 10,
      checkStatus: 'expiring',
    });
    mockGetSummary.mockResolvedValue(
      summary({ safeguardingOfficer: officer(), safeguardingOfficers: [officer(), deputy] })
    );

    renderPage();

    expect(await screen.findByText('Aled Prosser')).toBeInTheDocument();
    expect(screen.getByText('Deputy Welfare Officer')).toBeInTheDocument();
    // The summary tile leads with the officer who needs attention.
    expect(screen.getAllByText('10 days remaining').length).toBeGreaterThanOrEqual(2);
  });

  it('says no officer is assigned when the club has none', async () => {
    mockGetSummary.mockResolvedValue(
      summary({ safeguardingOfficer: null, safeguardingOfficers: [] })
    );

    renderPage();

    expect(await screen.findByText('No welfare officer assigned.')).toBeInTheDocument();
  });
});
