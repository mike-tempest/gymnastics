import { UserRole } from '@club-manager/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signOut } from 'next-auth/react';

let mockRole = UserRole.SUPER_ADMIN;
let mockPath = '/compliance/dbs';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Test User', role: mockRole } },
    status: 'authenticated',
  }),
  signOut: jest.fn(),
}));
jest.mock('@/hooks/useClubRegion', () => ({ useClubRegion: () => ({ country: 'GB' }) }));

import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

describe('accessible navigation', () => {
  beforeEach(() => {
    mockRole = UserRole.SUPER_ADMIN;
    mockPath = '/compliance/dbs';
    jest.clearAllMocks();
  });

  it('removes collapsed links from the accessible navigation and marks only the current page', async () => {
    const user = userEvent.setup();
    render(<Sidebar isOpen={false} onClose={() => {}} />);
    expect(screen.getByRole('link', { name: 'DBS' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    await user.click(screen.getByRole('button', { name: 'Compliance' }));
    expect(screen.queryByRole('link', { name: 'DBS' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compliance' }));
    expect(screen.getByRole('link', { name: 'DBS' })).toBeVisible();
  });

  it.each([
    [UserRole.PARENT, '/parent', 'My Children', '/parent'],
    [UserRole.WELFARE_OFFICER, '/compliance', 'Compliance', '/compliance'],
    [UserRole.HEAD_COACH, '/sessions', 'Sessions', '/'],
    [UserRole.SUPER_ADMIN, '/', 'Admin', '/'],
  ])('shows the %s journey and a permitted logo destination', (role, path, label, home) => {
    mockRole = role;
    mockPath = path;
    render(<Sidebar isOpen={false} onClose={() => {}} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByRole('link', { name: /Tumblebase/ })).toHaveAttribute('href', home);
  });

  it('does not offer the payment return page as a standalone task', async () => {
    const user = userEvent.setup();
    render(<Sidebar isOpen={false} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Billing' }));
    expect(screen.queryByRole('link', { name: 'Mandates' })).not.toBeInTheDocument();
  });

  it('withholds the waiting list from squad coaches', () => {
    mockRole = UserRole.SQUAD_COACH;
    render(<Sidebar isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('link', { name: 'Waiting list' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Badges' })).toBeVisible();
  });

  it('supports keyboard opening, Escape, focus return and sign-out in the account menu', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TopBar onMenuClick={() => {}} />
      </QueryClientProvider>
    );
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'User menu for Test User' });
    trigger.focus();
    await user.keyboard('{Enter}');
    const item = await screen.findByRole('menuitem', { name: 'Sign Out' });
    expect(item).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard('{Enter}{Enter}');
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
  });

  it('traps mobile focus, closes on Escape and restores the menu trigger', async () => {
    const matchMedia = window.matchMedia as jest.Mock;
    matchMedia.mockReturnValueOnce({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    const onClose = jest.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <button id="navigation-trigger">Open menu</button>
        <Sidebar isOpen onClose={onClose} />
      </>
    );
    const dialog = await screen.findByRole('dialog', { name: 'Main navigation' });
    const logout = within(dialog).getByRole('button', { name: 'Log out' });
    logout.focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    rerender(
      <>
        <button id="navigation-trigger">Open menu</button>
        <Sidebar isOpen={false} onClose={onClose} />
      </>
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });
});
