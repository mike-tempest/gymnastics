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
  getSkillContext: jest.fn(),
  getSkillHistory: jest.fn().mockResolvedValue([]),
  previewAwardFees: jest.fn(),
  saveSkillAssessment: jest.fn(),
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
  getSkillContext,
  previewAwardFees,
  saveSkillAssessment,
  getMemberAwardProgress,
  installDefaultSchemes,
  recordAssessment,
} from '@/lib/api/awards';
import { getSquads } from '@/lib/api/squads';

import AssessAwardsPage from '../app/awards/assess/page';
import AwardsPage from '../app/awards/page';
import MemberAwards from '../components/members/MemberAwards';

const mockGetAwardSchemes = getAwardSchemes as jest.MockedFunction<typeof getAwardSchemes>;
const mockInstallDefaults = installDefaultSchemes as jest.MockedFunction<
  typeof installDefaultSchemes
>;
const mockGetSquads = getSquads as jest.MockedFunction<typeof getSquads>;
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
  const levelId = 'a1111111-1111-4111-8111-111111111111';
  const memberId = 'a2222222-2222-4222-8222-222222222222';
  const criterionId = 'a3333333-3333-4333-8333-333333333333';
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'a4444444-4444-4444-8444-444444444444'),
    });
    mockGetAwardSchemes.mockResolvedValue([
      { ...riseScheme, levels: [{ ...riseScheme.levels[0], level_id: levelId }] },
    ]);
    mockGetSquads.mockResolvedValue([]);
    (getSkillContext as jest.Mock).mockResolvedValue({
      level: riseScheme.levels[0],
      session: null,
      members: [{ member_id: memberId, first_name: 'Ava', last_name: 'Nolan' }],
      criteria: [
        { criterion_id: criterionId, name: 'Balance', required: true, active: true, version: 3 },
      ],
      progress: [],
    });
    (saveSkillAssessment as jest.Mock).mockResolvedValue({ recorded: 1 });
    mockRecordAssessment.mockResolvedValue({ awarded: 1, invoices_raised: 0, warnings: [] });
    (previewAwardFees as jest.Mock).mockResolvedValue({
      hash: 'a'.repeat(64),
      currency: 'GBP',
      rows: [
        {
          member_id: memberId,
          member_name: 'Ava Nolan',
          family_name: 'Nolan family',
          total_amount: 4.5,
          reason: null,
        },
      ],
    });
  });
  async function load() {
    renderWithQueryClient(<AssessAwardsPage />);
    await screen.findByRole('option', { name: 'British Gymnastics Rise: Explore 3' });
    await userEvent.selectOptions(screen.getByLabelText('Badge'), levelId);
    await userEvent.click(screen.getByRole('button', { name: 'Load register' }));
    await screen.findByRole('heading', { name: 'Ava Nolan' });
    await waitFor(() => expect(screen.getByLabelText('Ava Nolan: Balance')).toBeEnabled());
  }
  it('leaves every result unchanged until the coach explicitly chooses one', async () => {
    await load();
    expect(screen.getByLabelText('Ava Nolan: Balance')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save skill progress (0)' })).toBeDisabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
  it('shows an existing badge award and invoice instead of suggesting another award', async () => {
    const base = await getSkillContext(levelId);
    (getSkillContext as jest.Mock).mockResolvedValue({
      ...base,
      level_progress: [
        { member_id: memberId, status: 'awarded', awarded_on: '2026-09-19', has_invoice: true },
      ],
    });
    await load();
    expect(
      screen.getByText('Badge awarded on 19/09/2026. Fees already invoiced.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ready for a coach/)).not.toBeInTheDocument();
  });

  it('saves selected skills with separate notes and no invoice', async () => {
    await load();
    await userEvent.selectOptions(screen.getByLabelText('Ava Nolan: Balance'), 'achieved');
    const original = await (getSkillContext as jest.Mock).mock.results[0].value;
    (getSkillContext as jest.Mock).mockResolvedValue({
      ...original,
      progress: [
        { member_id: memberId, criterion_id: criterionId, status: 'achieved', version: 1 },
      ],
    });
    await userEvent.type(screen.getByLabelText('Staff note'), 'Private assessment');
    await userEvent.type(screen.getByLabelText('Note visible to parents'), 'Well done');
    await userEvent.click(screen.getByRole('button', { name: 'Save skill progress (1)' }));
    await waitFor(() =>
      expect(saveSkillAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          results: [
            expect.objectContaining({
              member_id: memberId,
              criterion_id: criterionId,
              expected_version: 0,
              criterion_version: 3,
              status: 'achieved',
              internal_note: 'Private assessment',
              parent_note: 'Well done',
            }),
          ],
        })
      )
    );
    expect(await screen.findByText(/1 of 1 required skills achieved/)).toBeInTheDocument();
    expect(mockRecordAssessment).not.toHaveBeenCalled();
    expect(previewAwardFees).not.toHaveBeenCalled();
  });
  it('defaults an explicit badge award to no fees', async () => {
    await load();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Award badges without fees (1)' }));
    await waitFor(() =>
      expect(mockRecordAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ bill_fees: false })
      )
    );
  });
  it('requires a separate confirmation of the displayed family fees', async () => {
    await load();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Review badge fees' }));
    expect(await screen.findByText(/Nolan family/)).toHaveTextContent('£4.50');
    expect(mockRecordAssessment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm awards and listed fees' }));
    await waitFor(() =>
      expect(mockRecordAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ bill_fees: true, fee_preview_hash: 'a'.repeat(64) })
      )
    );
  });
  it('retries an uncertain save with exactly the same request', async () => {
    (saveSkillAssessment as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));
    await load();
    await userEvent.selectOptions(screen.getByLabelText('Ava Nolan: Balance'), 'achieved');
    await userEvent.click(screen.getByRole('button', { name: 'Save skill progress (1)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry the same save' }));
    await waitFor(() => expect(saveSkillAssessment).toHaveBeenCalledTimes(2));
    expect((saveSkillAssessment as jest.Mock).mock.calls[0][0]).toEqual(
      (saveSkillAssessment as jest.Mock).mock.calls[1][0]
    );
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
