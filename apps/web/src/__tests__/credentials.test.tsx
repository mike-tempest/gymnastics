import { CredentialStatus, CredentialType } from '@club-manager/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';

/**
 * The credential tracker (TEM-30): first aid, coaching qualifications and
 * safeguarding training, each with an expiry date the service watches. These
 * tests cover what a welfare officer sees and what the add form sends.
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/compliance/credentials',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Admin', role: 'super_admin' } },
    status: 'authenticated',
  }),
  signOut: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/lib/api/clubs', () => ({ getMyClub: jest.fn().mockResolvedValue(null) }));

jest.mock('@/lib/api/compliance', () => ({
  getCredentials: jest.fn(),
  createCredential: jest.fn(),
  updateCredential: jest.fn(),
}));

jest.mock('@/lib/api/staff', () => ({ listUsers: jest.fn() }));
jest.mock('@/lib/api/members', () => ({ getMembers: jest.fn() }));

// Imports after mocking so the mocks are applied.
import CredentialsPage from '@/app/compliance/credentials/page';
import { createCredential, getCredentials } from '@/lib/api/compliance';
import { getMembers } from '@/lib/api/members';
import { listUsers } from '@/lib/api/staff';

const mockGetCredentials = getCredentials as jest.MockedFunction<typeof getCredentials>;
const mockCreateCredential = createCredential as jest.MockedFunction<typeof createCredential>;
const mockListUsers = listUsers as jest.MockedFunction<typeof listUsers>;
const mockGetMembers = getMembers as jest.MockedFunction<typeof getMembers>;

const COACH = {
  user_id: 'user-1',
  first_name: 'Sofia',
  last_name: 'Tavares',
  email: 'sofia.tavares@example.com',
};

const FIRST_AID = {
  credential_id: 'cred-1',
  user_id: COACH.user_id,
  member_id: null,
  credential_type: CredentialType.FIRST_AID,
  title: 'Emergency First Aid at Work',
  issuing_body: 'St John Ambulance',
  reference_number: 'FA-2026-118',
  issue_date: '2023-10-01',
  expiry_date: '2026-09-15',
  status: CredentialStatus.EXPIRING_SOON,
  document_reference: null,
  notes: null,
  user: COACH,
  member: null,
};

const COACHING = {
  ...FIRST_AID,
  credential_id: 'cred-2',
  credential_type: CredentialType.COACHING_QUALIFICATION,
  title: 'UKCC Level 2 Coaching Womens Artistic Gymnastics',
  issuing_body: 'British Gymnastics',
  reference_number: 'BG-COACH-4471',
  expiry_date: null,
  status: CredentialStatus.VALID,
};

function renderPage(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Credential tracker page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCredentials.mockResolvedValue([FIRST_AID, COACHING]);
    mockListUsers.mockResolvedValue([COACH]);
    mockGetMembers.mockResolvedValue([]);
  });

  it('lists each credential with its holder, type and expiry status', async () => {
    renderPage(<CredentialsPage />);

    await waitFor(() =>
      expect(screen.getAllByText('Emergency First Aid at Work').length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText('Sofia Tavares').length).toBeGreaterThan(0);
    expect(screen.getAllByText('First aid').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expiring soon').length).toBeGreaterThan(0);
  });

  it('says plainly when a credential does not expire', async () => {
    renderPage(<CredentialsPage />);

    await waitFor(() => expect(screen.getAllByText('Does not expire').length).toBeGreaterThan(0));
  });

  it('sends the subject as a user id when adding a staff credential', async () => {
    // delay: null keeps the typing synchronous: with the default per-keystroke
    // delay this test is slow enough to race its own waitFor under a loaded
    // parallel run.
    const user = userEvent.setup({ delay: null });
    mockCreateCredential.mockResolvedValue(FIRST_AID);
    renderPage(<CredentialsPage />);

    await waitFor(() => expect(mockGetCredentials).toHaveBeenCalled(), { timeout: 10000 });
    await user.click(screen.getByRole('button', { name: /add credential/i }));

    await waitFor(() => expect(screen.getByLabelText(/staff member$/i)).toBeInTheDocument(), {
      timeout: 10000,
    });
    await user.selectOptions(screen.getByLabelText(/staff member$/i), COACH.user_id);
    await user.type(screen.getByLabelText(/^credential$/i), 'Safeguarding refresher');
    await user.type(screen.getByLabelText(/issue date/i), '2026-01-15');
    await user.click(screen.getByRole('button', { name: /save credential/i }));

    await waitFor(() => expect(mockCreateCredential).toHaveBeenCalled(), { timeout: 10000 });
    expect(mockCreateCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: COACH.user_id,
        title: 'Safeguarding refresher',
        issue_date: '2026-01-15',
      })
    );
    // No member id is sent for a staff credential: the subject is one or the
    // other, never both.
    expect(mockCreateCredential.mock.calls[0][0]).not.toHaveProperty('member_id');
  });
});
