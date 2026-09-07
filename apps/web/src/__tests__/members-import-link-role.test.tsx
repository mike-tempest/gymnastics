import { UserRole, type Member, type Squad } from '@club-manager/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/members',
}));

// A squad coach: the middleware lets them onto /members but not into /admin.
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Coach', role: 'squad_coach' } },
    status: 'authenticated',
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/api/members', () => ({
  getMembers: jest.fn(),
  getMember: jest.fn(),
  createMember: jest.fn(),
  updateMember: jest.fn(),
  deleteMember: jest.fn(),
}));

jest.mock('@/lib/api/squads', () => ({
  getSquads: jest.fn(),
}));

jest.mock('@/lib/api/clubs', () => ({
  getMyClub: jest.fn().mockRejectedValue(new Error('No club')),
}));

import { getMembers } from '@/lib/api/members';
import { getSquads } from '@/lib/api/squads';

import MembersPage from '../app/members/page';

const mockGetMembers = getMembers as jest.MockedFunction<typeof getMembers>;
const mockGetSquads = getSquads as jest.MockedFunction<typeof getSquads>;

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('The import link on the gymnast list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMembers.mockResolvedValue([] as unknown as Member[]);
    mockGetSquads.mockResolvedValue([] as unknown as Squad[]);
  });

  it('is hidden from a coach, who cannot reach the admin importer', async () => {
    expect(UserRole.SQUAD_COACH).toBe('squad_coach');

    render(<MembersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Gymnasts' })).toBeInTheDocument();
    });
    expect(screen.queryByText('Import CSV')).not.toBeInTheDocument();
  });
});
