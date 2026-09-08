import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, ReactNode } from 'react';

// The consent register used to render the raw consent rows the backend
// returned: one row per consent record, every gymnast name and squad blank,
// every badge "No" and every date "Invalid Date", which contradicted the
// compliance dashboard beside it. It now renders a per-member aggregate, so
// these assertions are about the register agreeing with the dashboard.

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/compliance/consent',
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
  getConsentData: jest.fn(),
}));

import ConsentManagementPage from '@/app/compliance/consent/page';
import { getConsentData, type MemberConsent } from '@/lib/api/compliance';

const mockGetConsentData = getConsentData as jest.MockedFunction<typeof getConsentData>;

function row(overrides: Partial<MemberConsent> = {}): MemberConsent {
  return {
    id: 'member-1',
    name: 'Nia Hopkins',
    squad: 'Rise Explore',
    medicalConsent: true,
    photoConsent: true,
    dataConsent: true,
    lastUpdated: '2026-03-04T09:30:00.000Z',
    ...overrides,
  };
}

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<ConsentManagementPage />, { wrapper: Wrapper });
}

/** The desktop table. The page also renders a mobile card list, so scoping
 * queries to one of the two keeps every row assertion unambiguous. */
async function registerTable(): Promise<HTMLElement> {
  return await screen.findByRole('table');
}

/** The stat tile with the given label, so counters are read where they live. */
async function statTile(label: string): Promise<HTMLElement> {
  const heading = await screen.findByText(label);
  return heading.closest('div')?.parentElement as HTMLElement;
}

describe('ConsentManagementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyClub.mockResolvedValue({ id: 'club-1', name: 'Demo Gym', country: 'GB' });
  });

  it('shows each gymnast with their name and squad', async () => {
    mockGetConsentData.mockResolvedValue([
      row(),
      row({ id: 'member-2', name: 'Ffion Rees', squad: 'Rise Discover' }),
    ]);

    renderPage();
    const table = within(await registerTable());

    expect(table.getByText('Nia Hopkins')).toBeInTheDocument();
    expect(table.getByText('Ffion Rees')).toBeInTheDocument();
    expect(table.getByText('Rise Explore')).toBeInTheDocument();
    expect(table.getByText('Rise Discover')).toBeInTheDocument();
  });

  it('counts gymnasts, not consent records', async () => {
    // Eleven complete and five partial, the same split the compliance
    // dashboard reports for this club.
    const complete = Array.from({ length: 11 }, (_, i) =>
      row({ id: `complete-${i}`, name: `Complete Gymnast ${i}` })
    );
    const partial = Array.from({ length: 5 }, (_, i) =>
      row({
        id: `partial-${i}`,
        name: `Partial Gymnast ${i}`,
        photoConsent: false,
        dataConsent: false,
      })
    );
    mockGetConsentData.mockResolvedValue([...complete, ...partial]);

    renderPage();

    expect(within(await statTile('Total gymnasts')).getByText('16')).toBeInTheDocument();
    expect(within(await statTile('All consents complete')).getByText('11')).toBeInTheDocument();
    expect(within(await statTile('Incomplete')).getByText('5')).toBeInTheDocument();
  });

  it('shows a granted consent as yes and a missing one as no', async () => {
    mockGetConsentData.mockResolvedValue([row({ photoConsent: false })]);

    renderPage();
    const table = within(await registerTable());

    expect(table.getAllByText('Yes')).toHaveLength(2);
    expect(table.getAllByText('No')).toHaveLength(1);
  });

  it('formats the last-updated date rather than printing an invalid one', async () => {
    mockGetConsentData.mockResolvedValue([row()]);

    renderPage();

    expect((await screen.findAllByText('04/03/2026')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });

  it('says a gymnast with nothing on file has never granted consent', async () => {
    mockGetConsentData.mockResolvedValue([
      row({
        medicalConsent: false,
        photoConsent: false,
        dataConsent: false,
        lastUpdated: null,
      }),
    ]);

    renderPage();

    expect((await screen.findAllByText('Never')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });

  it('says so when a gymnast is not in a squad yet', async () => {
    mockGetConsentData.mockResolvedValue([row({ squad: '' })]);

    renderPage();

    expect((await screen.findAllByText('Not assigned')).length).toBeGreaterThan(0);
  });

  it('filters to the incomplete gymnasts on request', async () => {
    const user = userEvent.setup();
    mockGetConsentData.mockResolvedValue([
      row(),
      row({
        id: 'member-2',
        name: 'Ffion Rees',
        squad: 'Rise Discover',
        dataConsent: false,
      }),
    ]);

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Incomplete (1)' }));
    const table = within(await registerTable());

    expect(table.getByText('Ffion Rees')).toBeInTheDocument();
    expect(table.queryByText('Nia Hopkins')).not.toBeInTheDocument();
  });
});
