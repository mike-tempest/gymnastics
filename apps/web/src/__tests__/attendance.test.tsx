import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
const mockGetSessionAttendance = jest.fn();
const mockCheckInMember = jest.fn();
const mockUpdateAttendance = jest.fn();
const mockMarkAttendance = jest.fn();

jest.mock('@/lib/api/attendance', () => ({
  getSessionAttendance: (...args: unknown[]) => mockGetSessionAttendance(...args),
  checkInMember: (...args: unknown[]) => mockCheckInMember(...args),
  updateAttendance: (...args: unknown[]) => mockUpdateAttendance(...args),
  markAttendance: (...args: unknown[]) => mockMarkAttendance(...args),
}));

const mockAttendanceData = [
  {
    attendance_id: 'att-1',
    session_id: 'session-1',
    member_id: 'member-1',
    status: null,
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
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
    attendance_id: 'att-3',
    session_id: 'session-1',
    member_id: 'member-3',
    status: null,
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
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
    mockGetSessionAttendance.mockResolvedValue(mockAttendanceData);
  });

  it('renders the member list from the attendance data', async () => {
    render(
      <AttendanceRoster sessionId="session-1" sessionName="Monday Training" />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });
  });

  it('shows the session name and member count', async () => {
    render(
      <AttendanceRoster sessionId="session-1" sessionName="Monday Training" />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Monday Training')).toBeInTheDocument();
      expect(screen.getByText('3 members')).toBeInTheDocument();
    });
  });

  it('shows the Mark All Present button with the unmarked count', async () => {
    render(
      <AttendanceRoster sessionId="session-1" sessionName="Monday Training" />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Mark All Present (2)')).toBeInTheDocument();
    });
  });

  it('shows a loading state before data arrives', () => {
    mockGetSessionAttendance.mockReturnValue(new Promise(() => {}));

    render(
      <AttendanceRoster sessionId="session-1" sessionName="Monday Training" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Loading roster...')).toBeInTheDocument();
  });

  it('renders an empty state when there are no members', async () => {
    mockGetSessionAttendance.mockResolvedValue([]);

    render(
      <AttendanceRoster sessionId="session-1" sessionName="Monday Training" />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'No members in this session' }),
      ).toBeInTheDocument();
    });
  });

  it('calls markAttendance for all unmarked members when Mark All Present is clicked', async () => {
    mockMarkAttendance.mockResolvedValue(undefined);

    render(
      <AttendanceRoster sessionId="session-1" sessionName="Monday Training" />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Mark All Present (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mark All Present (2)'));

    await waitFor(() => {
      expect(mockMarkAttendance).toHaveBeenCalledWith(
        'session-1',
        ['member-1', 'member-3'],
        'present',
      );
    });
  });
});
