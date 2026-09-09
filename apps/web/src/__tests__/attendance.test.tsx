import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import AttendanceRoster from '../components/attendance/AttendanceRoster';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/attendance',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Coach', role: 'COACH' } }, status: 'authenticated' }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// Mock attendance API
const mockGetSessionRoster = jest.fn();
const mockCheckInMember = jest.fn();
const mockCreateAttendance = jest.fn();
const mockUpdateAttendance = jest.fn();
const mockMarkAttendance = jest.fn();

jest.mock('@/lib/api/attendance', () => ({
  getSessionRoster: (...args: unknown[]) => mockGetSessionRoster(...args),
  checkInMember: (...args: unknown[]) => mockCheckInMember(...args),
  createAttendance: (...args: unknown[]) => mockCreateAttendance(...args),
  updateAttendance: (...args: unknown[]) => mockUpdateAttendance(...args),
  markAttendance: (...args: unknown[]) => mockMarkAttendance(...args),
}));

/**
 * A register part-way through being taken: Bob has been marked, Alice and
 * Charlie have not. An unmarked gymnast has no attendance row behind them, so
 * they carry a null attendance_id, which is what the roster endpoint returns
 * for a session nobody has taken the register for yet.
 */
const mockRosterData = [
  {
    attendance_id: null,
    session_id: 'session-1',
    member_id: 'member-1',
    status: null,
    notes: null,
    created_at: null,
    updated_at: null,
    member: {
      member_id: 'member-1',
      first_name: 'Alice',
      last_name: 'Smith',
      photo_url: null,
    },
  },
  {
    attendance_id: 'att-2',
    session_id: 'session-1',
    member_id: 'member-2',
    status: 'present',
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    member: {
      member_id: 'member-2',
      first_name: 'Bob',
      last_name: 'Jones',
      photo_url: null,
    },
  },
  {
    attendance_id: null,
    session_id: 'session-1',
    member_id: 'member-3',
    status: null,
    notes: null,
    created_at: null,
    updated_at: null,
    member: {
      member_id: 'member-3',
      first_name: 'Charlie',
      last_name: 'Brown',
      photo_url: null,
    },
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('AttendanceRoster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionRoster.mockResolvedValue(mockRosterData);
  });

  it('renders the member list from the attendance data', async () => {
    render(<AttendanceRoster sessionId="session-1" sessionName="Monday Training" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });
  });

  it('shows the session name and member count', async () => {
    render(<AttendanceRoster sessionId="session-1" sessionName="Monday Training" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Monday Training')).toBeInTheDocument();
      expect(screen.getByText('3 gymnasts')).toBeInTheDocument();
    });
  });

  it('shows the Mark All Present button with the unmarked count', async () => {
    render(<AttendanceRoster sessionId="session-1" sessionName="Monday Training" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Mark All Present (2)')).toBeInTheDocument();
    });
  });

  it('shows a loading state before data arrives', () => {
    mockGetSessionRoster.mockReturnValue(new Promise(() => {}));

    render(<AttendanceRoster sessionId="session-1" sessionName="Monday Training" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Loading roster...')).toBeInTheDocument();
  });

  it('renders an empty state when there are no members', async () => {
    mockGetSessionRoster.mockResolvedValue([]);

    render(<AttendanceRoster sessionId="session-1" sessionName="Monday Training" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'No gymnasts in this session' })
      ).toBeInTheDocument();
    });
  });

  it('calls markAttendance for all unmarked members when Mark All Present is clicked', async () => {
    mockMarkAttendance.mockResolvedValue(undefined);

    render(<AttendanceRoster sessionId="session-1" sessionName="Monday Training" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Mark All Present (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mark All Present (2)'));

    await waitFor(() => {
      expect(mockMarkAttendance).toHaveBeenCalledWith(
        'session-1',
        ['member-1', 'member-3'],
        'present'
      );
    });
  });

  it('checks in an unmarked gymnast when their row is tapped', async () => {
    mockCheckInMember.mockResolvedValue(undefined);

    render(<AttendanceRoster sessionId="session-1" sessionName="Monday Training" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const alice = screen.getByRole('button', { name: 'Alice Smith: not yet marked' });
    fireEvent.mouseDown(alice);
    fireEvent.mouseUp(alice);

    await waitFor(() => {
      expect(mockCheckInMember).toHaveBeenCalledWith('session-1', 'member-1');
    });
  });

  // An unmarked gymnast has no row to update, so a chosen status has to create
  // one. Checking them in instead would record present whatever was picked.
  it('creates a row with the chosen status for an unmarked gymnast', async () => {
    mockCreateAttendance.mockResolvedValue(undefined);

    render(<AttendanceRoster sessionId="session-1" sessionName="Monday Training" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    // A long press opens the status selector rather than marking present.
    jest.useFakeTimers();
    const alice = screen.getByRole('button', { name: 'Alice Smith: not yet marked' });
    fireEvent.mouseDown(alice);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    fireEvent.mouseUp(alice);
    jest.useRealTimers();

    fireEvent.click(await screen.findByRole('button', { name: 'Absent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockCreateAttendance).toHaveBeenCalledWith('session-1', 'member-1', 'absent', null);
    });
    expect(mockCheckInMember).not.toHaveBeenCalled();
  });
});
