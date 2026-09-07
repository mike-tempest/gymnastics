import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => '/awards',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Admin', role: 'super_admin' } },
    status: 'authenticated',
  }),
  signOut: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/api/awards', () => ({
  getAwardSchemes: jest.fn(),
  createAwardScheme: jest.fn(),
  updateAwardScheme: jest.fn(),
  deleteAwardScheme: jest.fn(),
  installDefaultSchemes: jest.fn(),
  createAwardLevel: jest.fn(),
  updateAwardLevel: jest.fn(),
  deleteAwardLevel: jest.fn(),
  getMemberAwardProgress: jest.fn(),
  getProgressForMembers: jest.fn(),
  recordAssessment: jest.fn(),
  previewRiseImport: jest.fn(),
  importRiseCsv: jest.fn(),
  riseExportPath: jest.fn(() => '/awards/export/rise.csv'),
  // The real helper: coercing a decimal string is the behaviour under test.
  feeAmount: (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  },
}));

jest.mock('@/lib/api/members', () => ({ getMembers: jest.fn() }));
jest.mock('@/lib/api/squads', () => ({ getSquads: jest.fn() }));

// Import after mocking
import {
  getAwardSchemes,
  getMemberAwardProgress,
  getProgressForMembers,
  installDefaultSchemes,
  recordAssessment,
} from '@/lib/api/awards';
import { getMembers } from '@/lib/api/members';
import { getSquads } from '@/lib/api/squads';

import AssessAwardsPage from '../app/awards/assess/page';
import AwardsPage from '../app/awards/page';
import MemberAwards from '../components/members/MemberAwards';

const mockGetAwardSchemes = getAwardSchemes as jest.MockedFunction<typeof getAwardSchemes>;
const mockInstallDefaults = installDefaultSchemes as jest.MockedFunction<
  typeof installDefaultSchemes
>;
const mockGetMembers = getMembers as jest.MockedFunction<typeof getMembers>;
const mockGetSquads = getSquads as jest.MockedFunction<typeof getSquads>;
const mockGetProgressForMembers = getProgressForMembers as jest.MockedFunction<
  typeof getProgressForMembers
>;
const mockRecordAssessment = recordAssessment as jest.MockedFunction<typeof recordAssessment>;
const mockGetMemberProgress = getMemberAwardProgress as jest.MockedFunction<
  typeof getMemberAwardProgress
>;

/**
 * MainLayout renders a Sidebar that resolves the club's governing-body label
 * through react-query, so a QueryClient has to be present.
 */
function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const riseScheme = {
  scheme_id: 'scheme-1',
  club_id: 'club-1',
  name: 'British Gymnastics Rise',
  description: 'Discover, Explore and Excel.',
  source: 'bg-rise' as const,
  active: true,
  levels: [
    {
      level_id: 'level-1',
      club_id: 'club-1',
      scheme_id: 'scheme-1',
      name: 'Explore 3',
      description: null,
      sort_order: 3,
      // Decimals arrive from the API as strings.
      badge_fee: '4.50',
      certificate_fee: null,
      fee_structure_id: null,
      active: true,
    },
  ],
};

describe('Badges page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAwardSchemes.mockResolvedValue([riseScheme]);
  });

  it('lists a club scheme with its badges', async () => {
    renderWithQueryClient(<AwardsPage />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'British Gymnastics Rise' })).toBeInTheDocument()
    );
    expect(screen.getByText('Explore 3')).toBeInTheDocument();
  });

  it('renders a badge fee that arrived as a decimal string', async () => {
    renderWithQueryClient(<AwardsPage />);

    await waitFor(() => expect(screen.getByText('£4.50')).toBeInTheDocument());
  });

  it('shows a badge with no fee as free rather than as zero', async () => {
    mockGetAwardSchemes.mockResolvedValue([
      { ...riseScheme, levels: [{ ...riseScheme.levels[0], badge_fee: null }] },
    ]);

    renderWithQueryClient(<AwardsPage />);

    await waitFor(() => expect(screen.getByText('Free')).toBeInTheDocument());
  });

  it('offers the starter schemes when the club has none, and installs them on request', async () => {
    mockGetAwardSchemes.mockResolvedValue([]);
    mockInstallDefaults.mockResolvedValue({
      installed: ['British Gymnastics Rise'],
      skipped: [],
    });

    renderWithQueryClient(<AwardsPage />);

    const button = await screen.findByRole('button', { name: 'Add the starter schemes' });
    await userEvent.click(button);

    await waitFor(() => expect(mockInstallDefaults).toHaveBeenCalled());
  });

  it('links through to the assessment flow', async () => {
    renderWithQueryClient(<AwardsPage />);

    const link = await screen.findByRole('link', { name: /assess and award/i });
    expect(link).toHaveAttribute('href', '/awards/assess');
  });
});

describe('Assessment flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAwardSchemes.mockResolvedValue([riseScheme]);
    mockGetSquads.mockResolvedValue([
      { squad_id: 'squad-1', squad_name: 'Recreational Tuesday' },
    ] as never);
    mockGetMembers.mockResolvedValue([
      { member_id: 'member-1', first_name: 'Ava', last_name: 'Nolan', squad_id: 'squad-1' },
    ] as never);
    mockGetProgressForMembers.mockResolvedValue([]);
    mockRecordAssessment.mockResolvedValue({ awarded: 1, invoices_raised: 1, warnings: [] });
  });

  it('records an award for a chosen badge and gymnast', async () => {
    renderWithQueryClient(<AssessAwardsPage />);

    await waitFor(() => expect(screen.getByLabelText('Badge')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Badge'), 'level-1');
    await waitFor(() => expect(screen.getByText('Ava Nolan')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Result for Ava Nolan'), 'awarded');
    await userEvent.click(screen.getByRole('button', { name: 'Record assessment' }));

    await waitFor(() =>
      expect(mockRecordAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          level_id: 'level-1',
          bill_fees: true,
          outcomes: [{ member_id: 'member-1', outcome: 'awarded' }],
        })
      )
    );
  });

  it('will not submit until a result has been recorded', async () => {
    renderWithQueryClient(<AssessAwardsPage />);

    await waitFor(() => expect(screen.getByLabelText('Badge')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Badge'), 'level-1');

    expect(await screen.findByRole('button', { name: 'Record assessment' })).toBeDisabled();
  });

  it('lets a coach turn the badge fee off before recording', async () => {
    renderWithQueryClient(<AssessAwardsPage />);

    await waitFor(() => expect(screen.getByLabelText('Badge')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Badge'), 'level-1');
    await waitFor(() => expect(screen.getByText('Ava Nolan')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Result for Ava Nolan'), 'awarded');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Record assessment' }));

    await waitFor(() =>
      expect(mockRecordAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ bill_fees: false })
      )
    );
  });

  it('tells the coach nothing can be assessed when no badges exist', async () => {
    mockGetAwardSchemes.mockResolvedValue([]);

    renderWithQueryClient(<AssessAwardsPage />);

    expect(await screen.findByText('No badges to assess yet')).toBeInTheDocument();
  });
});

describe('Gymnast badge history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists what a gymnast has been awarded', async () => {
    mockGetMemberProgress.mockResolvedValue([
      {
        progress_id: 'progress-1',
        member_id: 'member-1',
        level_id: 'level-1',
        status: 'awarded',
        started_on: null,
        assessed_on: '2026-09-01',
        awarded_on: '2026-09-01',
        notes: null,
        invoice_id: 'invoice-1',
        level: { ...riseScheme.levels[0], scheme: riseScheme },
      },
    ] as never);

    renderWithQueryClient(<MemberAwards memberId="member-1" />);

    expect(await screen.findByText('Explore 3')).toBeInTheDocument();
    expect(screen.getByText('Awarded')).toBeInTheDocument();
    expect(screen.getByText('British Gymnastics Rise')).toBeInTheDocument();
  });

  it('says so plainly when there is no badge history yet', async () => {
    mockGetMemberProgress.mockResolvedValue([]);

    renderWithQueryClient(<MemberAwards memberId="member-1" />);

    expect(await screen.findByText(/has not been assessed for a badge yet/i)).toBeInTheDocument();
  });
});
