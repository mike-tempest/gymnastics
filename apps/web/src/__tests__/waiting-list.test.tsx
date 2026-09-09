import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';

/**
 * The hero flow's surfaces (TEM-22): the public join page a parent uses with
 * no account, the offer page they answer from an email link, and the admin
 * list that turns an offer into an enrolled member in one click.
 */

const pushMock = jest.fn();
let searchParamValue: string | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: () => searchParamValue }),
  usePathname: () => '/waiting-list',
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

jest.mock('@/lib/api/waiting-list', () => ({
  getWaitingList: jest.fn(),
  getWaitingListSummary: jest.fn(),
  getWaitingListEntry: jest.fn(),
  getPendingOffers: jest.fn(),
  getWaitingListSettings: jest.fn(),
  updateWaitingListSettings: jest.fn(),
  createWaitingListEntry: jest.fn(),
  updateWaitingListEntry: jest.fn(),
  withdrawWaitingListEntry: jest.fn(),
  offerPlace: jest.fn(),
  withdrawOffer: jest.fn(),
  enrolFromWaitingList: jest.fn(),
  getPublicClubDetails: jest.fn(),
  joinWaitingList: jest.fn(),
  getPublicOffer: jest.fn(),
  acceptPublicOffer: jest.fn(),
  declinePublicOffer: jest.fn(),
}));

jest.mock('@/lib/api/squads', () => ({ getSquads: jest.fn() }));

// Import after mocking
import { getSquads } from '@/lib/api/squads';
import {
  acceptPublicOffer,
  enrolFromWaitingList,
  getPendingOffers,
  getPublicClubDetails,
  getPublicOffer,
  getWaitingList,
  getWaitingListSettings,
  joinWaitingList,
} from '@/lib/api/waiting-list';

import JoinWaitingListPage from '../app/join/[clubSlug]/page';
import OfferPage from '../app/offer/[token]/page';
import WaitingListPage from '../app/waiting-list/page';

const mockGetWaitingList = getWaitingList as jest.MockedFunction<typeof getWaitingList>;
const mockGetPendingOffers = getPendingOffers as jest.MockedFunction<typeof getPendingOffers>;
const mockGetSettings = getWaitingListSettings as jest.MockedFunction<
  typeof getWaitingListSettings
>;
const mockGetSquads = getSquads as jest.MockedFunction<typeof getSquads>;
const mockEnrol = enrolFromWaitingList as jest.MockedFunction<typeof enrolFromWaitingList>;
const mockGetPublicClub = getPublicClubDetails as jest.MockedFunction<typeof getPublicClubDetails>;
const mockJoin = joinWaitingList as jest.MockedFunction<typeof joinWaitingList>;
const mockGetPublicOffer = getPublicOffer as jest.MockedFunction<typeof getPublicOffer>;
const mockAcceptOffer = acceptPublicOffer as jest.MockedFunction<typeof acceptPublicOffer>;

/** MainLayout's Sidebar resolves the club through react-query. */
function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const waitingRow = {
  entry_id: 'entry-1',
  club_id: 'club-1',
  child_first_name: 'Priya',
  child_last_name: 'Nandra',
  child_dob: '2018-03-01',
  child_gender: 'F',
  parent_name: 'Anita Nandra',
  parent_email: 'anita@example.com',
  parent_phone: null,
  desired_discipline: null,
  desired_squad_type: null,
  preferred_squad_id: null,
  notes: null,
  joined_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  is_existing_member_family: true,
  is_sibling: true,
  priority_boost: 0,
  status: 'waiting' as const,
  enrolled_member_id: null,
  withdrawn_reason: null,
  position: 1,
  pending_offer: null,
};

describe('Waiting list admin page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParamValue = null;
    mockGetWaitingList.mockResolvedValue([waitingRow]);
    mockGetPendingOffers.mockResolvedValue([]);
    mockGetSquads.mockResolvedValue([]);
    mockGetSettings.mockResolvedValue({ auto_offer_enabled: true, offer_window_days: 7 });
  });

  it('shows each child with their position, age and how long they have waited', async () => {
    renderWithQueryClient(<WaitingListPage />);

    await waitFor(() => expect(screen.getByText('Priya Nandra')).toBeInTheDocument());
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('1 month')).toBeInTheDocument();
  });

  it('shows the priority badges that explain the order', async () => {
    renderWithQueryClient(<WaitingListPage />);

    await waitFor(() => expect(screen.getByText('Club family')).toBeInTheDocument());
    expect(screen.getByText('Sibling')).toBeInTheDocument();
  });

  it('counts down a live offer rather than just saying it exists', async () => {
    mockGetWaitingList.mockResolvedValue([
      {
        ...waitingRow,
        status: 'offered' as const,
        pending_offer: {
          offer_id: 'offer-1',
          entry_id: 'entry-1',
          squad_id: 'squad-1',
          offered_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending' as const,
          decline_reason: null,
          responded_at: null,
        },
      },
    ]);

    renderWithQueryClient(<WaitingListPage />);

    await waitFor(() => expect(screen.getByText('Offered, 3 days left')).toBeInTheDocument());
  });

  it('reports exactly what the one click created, and what still needs a person', async () => {
    mockEnrol.mockResolvedValue({
      entry_id: 'entry-1',
      member_id: 'member-1',
      family_id: 'family-1',
      family_created: true,
      squad_id: null,
      squad_assigned: false,
      consents_requested: 3,
      invite_url: 'http://localhost:3000/invite/tok',
      enrolment_email_sent: true,
      mandate_email_sent: true,
      mandate_already_active: false,
      needs_attention: ['The squad place could not be given: Squad is at full capacity.'],
    });

    renderWithQueryClient(<WaitingListPage />);
    await waitFor(() => expect(screen.getByText('Priya Nandra')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Enrol' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enrol now' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Enrolled' })).toBeInTheDocument()
    );
    expect(screen.getByText('Created the family record')).toBeInTheDocument();
    expect(screen.getByText('Requested 3 consents from the parent')).toBeInTheDocument();
    expect(screen.getByText('Emailed the parent to set up the Direct Debit')).toBeInTheDocument();
    expect(screen.getByText('Still needs you')).toBeInTheDocument();
    expect(
      screen.getByText('The squad place could not be given: Squad is at full capacity.')
    ).toBeInTheDocument();
  });
});

describe('Public join page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParamValue = null;
    mockGetPublicClub.mockResolvedValue({
      club_name: 'Kestrel Vale Gymnastics Club',
      club_slug: 'kestrel-vale-gymnastics',
      squads: [
        {
          squad_id: 'squad-1',
          squad_name: 'Trampoline Recreational',
          squad_type: null,
          discipline: null,
        },
      ],
    });
  });

  it('names the club and asks for the child and the parent', async () => {
    render(<JoinWaitingListPage params={{ clubSlug: 'kestrel-vale-gymnastics' }} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Join the waiting list' })).toBeInTheDocument()
    );
    expect(screen.getAllByText(/Kestrel Vale Gymnastics Club/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('offers the club classes by name so a family can ask for one', async () => {
    render(<JoinWaitingListPage params={{ clubSlug: 'kestrel-vale-gymnastics' }} />);

    await waitFor(() => expect(screen.getByLabelText('A particular class')).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Trampoline Recreational' })).toBeInTheDocument();
  });

  it('confirms the position and says what happens next', async () => {
    mockJoin.mockResolvedValue({
      entry_id: 'entry-1',
      club_name: 'Kestrel Vale Gymnastics Club',
      position: 4,
      already_on_list: false,
    });

    render(<JoinWaitingListPage params={{ clubSlug: 'kestrel-vale-gymnastics' }} />);
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('First name'), 'Priya');
    await userEvent.type(screen.getByLabelText('Last name'), 'Nandra');
    await userEvent.type(screen.getByLabelText('Date of birth'), '2018-03-01');
    await userEvent.selectOptions(screen.getByLabelText('Gender'), 'F');
    await userEvent.type(screen.getByLabelText('Your name'), 'Anita Nandra');
    await userEvent.type(screen.getByLabelText('Email address'), 'anita@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Join the waiting list' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Priya is on the waiting list' })
      ).toBeInTheDocument()
    );
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
  });

  it('says so plainly when a resubmit finds the child already on the list', async () => {
    mockJoin.mockResolvedValue({
      entry_id: 'entry-1',
      club_name: 'Kestrel Vale Gymnastics Club',
      position: 4,
      already_on_list: true,
    });

    render(<JoinWaitingListPage params={{ clubSlug: 'kestrel-vale-gymnastics' }} />);
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('First name'), 'Priya');
    await userEvent.type(screen.getByLabelText('Last name'), 'Nandra');
    await userEvent.type(screen.getByLabelText('Date of birth'), '2018-03-01');
    await userEvent.selectOptions(screen.getByLabelText('Gender'), 'F');
    await userEvent.type(screen.getByLabelText('Your name'), 'Anita Nandra');
    await userEvent.type(screen.getByLabelText('Email address'), 'anita@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Join the waiting list' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Priya is already on the list' })
      ).toBeInTheDocument()
    );
  });
});

describe('Public offer page', () => {
  const liveOffer = {
    offer_id: 'offer-1',
    status: 'pending' as const,
    expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    club_name: 'Kestrel Vale Gymnastics Club',
    squad_name: 'Trampoline Recreational',
    training_times: 'Tuesdays, 5pm to 6pm',
    child_name: 'Priya Nandra',
    expired: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    searchParamValue = null;
    mockGetPublicOffer.mockResolvedValue(liveOffer);
  });

  it('shows the place, the class and the deadline', async () => {
    render(<OfferPage params={{ token: 'tok' }} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'A place has come up' })).toBeInTheDocument()
    );
    expect(screen.getByText('Tuesdays, 5pm to 6pm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept the place' })).toBeInTheDocument();
  });

  it('accepts the place and says what was set up', async () => {
    mockAcceptOffer.mockResolvedValue({
      enrolled: true,
      squad_assigned: true,
      invite_url: 'http://localhost:3000/invite/tok',
      mandate_setup_required: true,
    });

    render(<OfferPage params={{ token: 'tok' }} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Accept the place' })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', { name: 'Accept the place' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'That is confirmed' })).toBeInTheDocument()
    );
    expect(screen.getByText('Added them to the register for their class.')).toBeInTheDocument();
    expect(
      screen.getByText('Emailed you a separate link to set up the Direct Debit for fees.')
    ).toBeInTheDocument();
  });

  it('opens on the decline note when the email decline link is used', async () => {
    searchParamValue = '1';

    render(<OfferPage params={{ token: 'tok' }} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Turn down the place' })).toBeInTheDocument()
    );
  });

  it('explains a lapsed offer rather than letting it be accepted', async () => {
    mockGetPublicOffer.mockResolvedValue({
      ...liveOffer,
      expired: true,
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    render(<OfferPage params={{ token: 'tok' }} />);

    await waitFor(() =>
      expect(screen.getByText('This offer has run out of time')).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: 'Accept the place' })).not.toBeInTheDocument();
  });
});
