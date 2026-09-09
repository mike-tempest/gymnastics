import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { toast } from 'sonner';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/compliance/safeguarding',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Admin', role: 'ADMIN' } },
    status: 'authenticated',
  }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// Club region resolves via getMyClub; default to a GB club.
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

// Mock the compliance API surface used by the page.
jest.mock('@/lib/api/compliance', () => ({
  getChecklist: jest.fn(),
  getSafeguardingOfficer: jest.fn(),
  getIncidents: jest.fn(),
  updateChecklistItem: jest.fn(),
}));

// Imports after mocking so the mocks are applied.
import SafeguardingPage from '@/app/compliance/safeguarding/page';
import { ApiError } from '@/lib/api/api-client';
import {
  getChecklist,
  getSafeguardingOfficer,
  getIncidents,
  updateChecklistItem,
} from '@/lib/api/compliance';

const mockGetChecklist = getChecklist as jest.MockedFunction<typeof getChecklist>;
const mockGetOfficer = getSafeguardingOfficer as jest.MockedFunction<typeof getSafeguardingOfficer>;
const mockGetIncidents = getIncidents as jest.MockedFunction<typeof getIncidents>;
const mockUpdateChecklistItem = updateChecklistItem as jest.MockedFunction<
  typeof updateChecklistItem
>;

const CHECKLIST = [
  {
    id: 'c1',
    requirement: 'Welfare officer appointed',
    description: 'A designated officer is in place.',
    completed: true,
  },
  {
    id: 'c2',
    requirement: 'Policy published',
    description: 'The policy is available to members.',
    completed: false,
  },
];

const OFFICER = {
  name: 'Jane Doe',
  role: 'Club Welfare Officer',
  email: 'jane@example.com',
  phone: '01234 567890',
  dbsNumber: 'DBS-12345',
  dbsExpiry: '2027-01-01',
  qualifications: 'Safeguarding Level 2',
};

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<SafeguardingPage />, { wrapper: Wrapper });
}

describe('SafeguardingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetChecklist.mockResolvedValue([...CHECKLIST]);
    mockGetOfficer.mockResolvedValue({ ...OFFICER });
    mockGetIncidents.mockResolvedValue([]);
  });

  it('renders British Gymnastics safeguarding labels for a GB club by default', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-gb', name: 'Whitby Seals', country: 'GB' });

    renderPage();

    expect(
      await screen.findByText('Safeguarding and Protecting Children Policy compliance checklist')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Safeguarding and Protecting Children Policy compliance, Welfare Officer details, and incident tracking'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welfare Officer' })).toBeInTheDocument();
    expect(screen.getByText('DBS number')).toBeInTheDocument();
    expect(screen.getByText('DBS expiry')).toBeInTheDocument();
  });

  it('resolves US governing body labels for a US club', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-us', name: 'Austin Aquatics', country: 'US' });

    renderPage();

    expect(await screen.findByText('Safe Sport compliance checklist')).toBeInTheDocument();
    expect(
      screen.getByText('Safe Sport compliance, Safeguarding Officer details, and incident tracking')
    ).toBeInTheDocument();
    expect(screen.getByText('SafeSport number')).toBeInTheDocument();
    expect(screen.getByText('SafeSport expiry')).toBeInTheDocument();
    expect(screen.queryByText('Wavepower compliance checklist')).not.toBeInTheDocument();
  });

  it('titles the officer MPIO for an Australian club', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-au',
      name: 'Bondi Breakers',
      country: 'AU',
      governing_body: 'SWIMMING_AUSTRALIA',
    });

    renderPage();

    expect(await screen.findByText('Safe Sport compliance checklist')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Member Protection Information Officer (MPIO)' })
    ).toBeInTheDocument();
    expect(screen.getByText('WWCC number')).toBeInTheDocument();
    expect(screen.getByText('WWCC expiry')).toBeInTheDocument();
  });

  it('offers an add-officer action instead of a dead link when no officer exists', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-gb',
      name: 'Whitby Seals',
      country: 'GB',
      governing_body: 'SWIM_ENGLAND',
    });
    mockGetOfficer.mockResolvedValue(null);

    renderPage();

    const addButton = await screen.findByRole('button', { name: 'Add Club Welfare Officer' });
    fireEvent.click(addButton);

    // The modal opens on the same page (no /officer/new route exists).
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('optimistically toggles a checklist item and persists via the API', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-gb',
      name: 'Whitby Seals',
      country: 'GB',
      governing_body: 'SWIM_ENGLAND',
    });
    mockUpdateChecklistItem.mockResolvedValue({ ...CHECKLIST[1], completed: true });

    renderPage();

    await screen.findByText('Wavepower compliance checklist');

    const checkbox = screen.getByRole('checkbox', { name: 'Policy published' });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => expect(mockUpdateChecklistItem).toHaveBeenCalledWith('c2', true));
    expect(checkbox).toBeChecked();
  });

  it('reverts and surfaces a non-blocking toast when the PATCH 404s', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-gb',
      name: 'Whitby Seals',
      country: 'GB',
      governing_body: 'SWIM_ENGLAND',
    });
    mockUpdateChecklistItem.mockRejectedValue(new ApiError('Not found', 404));

    renderPage();

    await screen.findByText('Wavepower compliance checklist');

    const checkbox = screen.getByRole('checkbox', { name: 'Policy published' });
    fireEvent.click(checkbox);

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    // Reverted to its original unchecked state.
    expect(checkbox).not.toBeChecked();
  });
});
