import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

// Mock next/navigation (MainLayout reads the pathname)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/compliance',
}));

// Mock next-auth (MainLayout reads the session)
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

const mockGetComplianceSummary = jest.fn();
const mockGetDbsChecks = jest.fn();
jest.mock('@/lib/api/compliance', () => ({
  getComplianceSummary: (...args: unknown[]) => mockGetComplianceSummary(...args),
  getDbsChecks: (...args: unknown[]) => mockGetDbsChecks(...args),
}));

import DbsChecksPage from '../app/compliance/dbs/page';
import ComplianceDashboardPage from '../app/compliance/page';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const emptySummary = {
  healthScore: 0,
  totalMembers: 0,
  dbsValid: 0,
  dbsExpiringSoon: 0,
  dbsExpired: 0,
  consentComplete: 0,
  consentPartial: 0,
  consentMissing: 0,
  safeguardingOfficer: null,
  expiringDbsChecks: [],
};

describe('Compliance dashboard framework awareness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetComplianceSummary.mockResolvedValue(emptySummary);
    mockGetDbsChecks.mockResolvedValue([]);
  });

  it('shows the GB Swim England wording when the club country is unknown', async () => {
    mockGetMyClub.mockRejectedValue(new Error('No club'));

    render(<ComplianceDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Compliance and Wavepower' })).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Swim England Wavepower requirements/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Club Welfare Officer for Wavepower compliance/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add DBS checks' })).toBeInTheDocument();
  });

  it('shows SafeSport wording for a US club', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-us', name: 'Austin Aquatics', country: 'US' });

    render(<ComplianceDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Compliance and Safe Sport' })).toBeInTheDocument()
    );
    expect(
      screen.getByText(/USA Swimming Safe Sport requirements/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Safeguarding Officer for Safe Sport compliance/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add SafeSport checks' })).toBeInTheDocument();
    expect(screen.queryByText(/Wavepower/)).not.toBeInTheDocument();
  });

  it('shows the Australian WWCC and MPIO wording for an AU club', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-au',
      name: 'Bondi Breakers',
      country: 'AU',
      governing_body: 'SWIMMING_AUSTRALIA',
      governing_body_region: 'NSW',
    });

    render(<ComplianceDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Compliance and Safe Sport' })).toBeInTheDocument()
    );
    // No doubled "Check checks": the noun strips the trailing "Check".
    expect(screen.getByRole('link', { name: 'Add Working With Children checks' })).toBeInTheDocument();
    expect(
      screen.getByText(/Member Protection Information Officer \(MPIO\) for Safe Sport compliance/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Check checks/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wavepower/)).not.toBeInTheDocument();
  });
});

describe('DBS check tracker framework awareness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDbsChecks.mockResolvedValue([]);
  });

  it('keeps the GB DBS wording byte-identical for UK clubs', async () => {
    mockGetMyClub.mockRejectedValue(new Error('No club'));

    render(<DbsChecksPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'DBS check tracker' })).toBeInTheDocument()
    );
    expect(screen.getByText('Monitor DBS disclosure status for all staff and volunteers')).toBeInTheDocument();
    expect(screen.getByText('Expiring within 90 days')).toBeInTheDocument();
    expect(screen.getByText(/stay Wavepower compliant/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name, role, or DBS number...')).toBeInTheDocument();
    expect(screen.queryByText(/60 days/)).not.toBeInTheDocument();
  });

  it('renders SafeSport wording for a US club', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-us', name: 'Austin Aquatics', country: 'US' });

    render(<DbsChecksPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'SafeSport check tracker' })).toBeInTheDocument()
    );
    // Non-DBS frameworks drop the DBS-specific word "disclosure".
    expect(screen.getByText('Monitor SafeSport check status for all staff and volunteers')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name, role, or SafeSport number...')).toBeInTheDocument();
    expect(screen.getByText(/stay Safe Sport compliant/)).toBeInTheDocument();
    expect(screen.queryByText(/DBS/)).not.toBeInTheDocument();
  });

  it('renders WWCC wording without doubled Check for an AU club', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-au',
      name: 'Bondi Breakers',
      country: 'AU',
      governing_body: 'SWIMMING_AUSTRALIA',
      governing_body_region: 'QLD',
    });

    render(<DbsChecksPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Working With Children check tracker' })
      ).toBeInTheDocument()
    );
    expect(
      screen.getByText('Monitor Working With Children check status for all staff and volunteers')
    ).toBeInTheDocument();
    // Tight surfaces use the WWCC short label.
    expect(screen.getByPlaceholderText('Search by name, role, or WWCC number...')).toBeInTheDocument();
    expect(screen.queryByText(/Check check/)).not.toBeInTheDocument();
    expect(screen.queryByText(/disclosure/)).not.toBeInTheDocument();
    expect(screen.queryByText(/DBS/)).not.toBeInTheDocument();
  });
});
