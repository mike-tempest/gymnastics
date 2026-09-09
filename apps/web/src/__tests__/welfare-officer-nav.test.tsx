import { UserRole } from '@club-manager/shared-types';
import { render, screen } from '@testing-library/react';

// The Welfare Officer's sidebar. Before TEM-29 the role matched none of the
// web role sets, so Sidebar fell through to an empty list and a welfare
// officer signed in to a navigation with nothing in it.

let mockRole: string = UserRole.WELFARE_OFFICER;

jest.mock('next/navigation', () => ({
  usePathname: () => '/compliance',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        name: 'Gemma Laird',
        email: 'gemma.laird@example.org',
        role: mockRole,
        id: 'user-1',
      },
    },
    status: 'authenticated',
  }),
  signOut: jest.fn(),
}));

// The club lookup only drives the background-check label; keep it off the
// network and on the British Gymnastics default.
jest.mock('@/hooks/useClubRegion', () => ({
  useClubRegion: () => ({ country: 'GB', club: { governing_body: 'british_gymnastics' } }),
}));

import Sidebar from '@/components/layout/Sidebar';
import { MEMBER_NOUN_PLURAL } from '@/lib/brand';
import { isAdmin, isCoach, isParent, isWelfareOfficer } from '@/lib/hooks/useRole';

function renderSidebar() {
  return render(<Sidebar isOpen onClose={() => {}} />);
}

describe('Welfare Officer role model', () => {
  it('recognises the Welfare Officer as its own role', () => {
    expect(isWelfareOfficer(UserRole.WELFARE_OFFICER)).toBe(true);
  });

  it('does not fold the Welfare Officer into admin, coach or parent', () => {
    expect(isAdmin(UserRole.WELFARE_OFFICER)).toBe(false);
    expect(isCoach(UserRole.WELFARE_OFFICER)).toBe(false);
    expect(isParent(UserRole.WELFARE_OFFICER)).toBe(false);
  });

  it('does not treat other roles as Welfare Officers', () => {
    expect(isWelfareOfficer(UserRole.SUPER_ADMIN)).toBe(false);
    expect(isWelfareOfficer(UserRole.HEAD_COACH)).toBe(false);
    expect(isWelfareOfficer(UserRole.PARENT)).toBe(false);
    expect(isWelfareOfficer(null)).toBe(false);
  });
});

describe('Welfare Officer sidebar', () => {
  beforeEach(() => {
    mockRole = UserRole.WELFARE_OFFICER;
  });

  it('gives the Welfare Officer a compliance navigation rather than an empty one', () => {
    renderSidebar();

    const nav = screen.getByLabelText('Main navigation');
    expect(nav).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText(MEMBER_NOUN_PLURAL)).toBeInTheDocument();
  });

  it('links every compliance screen the role can read', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/compliance');
    expect(screen.getByRole('link', { name: 'DBS' })).toHaveAttribute('href', '/compliance/dbs');
    expect(screen.getByRole('link', { name: 'Consent' })).toHaveAttribute(
      'href',
      '/compliance/consent'
    );
    expect(screen.getByRole('link', { name: 'Safeguarding' })).toHaveAttribute(
      'href',
      '/compliance/safeguarding'
    );
    expect(screen.getByRole('link', { name: MEMBER_NOUN_PLURAL })).toHaveAttribute(
      'href',
      '/members'
    );
  });

  it('opens the compliance section on the compliance route', () => {
    renderSidebar();

    expect(screen.getByRole('button', { name: /Compliance/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('withholds the areas the role has no backend access to', () => {
    renderSidebar();

    expect(screen.queryByText('Billing')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument();
    expect(screen.queryByText('Attendance')).not.toBeInTheDocument();
    expect(screen.queryByText('Squads')).not.toBeInTheDocument();
    expect(screen.queryByText('Communications')).not.toBeInTheDocument();
    expect(screen.queryByText('Waiting list')).not.toBeInTheDocument();
  });

  it('still shows an admin the full navigation', () => {
    mockRole = UserRole.SUPER_ADMIN;

    renderSidebar();

    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
