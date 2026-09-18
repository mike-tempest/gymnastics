import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';

let mockRole = 'super_admin';
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: mockRole } } }),
}));
jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('@/hooks/useMigrationJourney', () => ({ useMigrationStepReporter: () => ({}) }));
jest.mock('@/components/import/MigrationStepBanner', () => ({
  __esModule: true,
  default: () => null,
  MigrationStepReturn: () => null,
}));
import StaffImportPage from '@/app/admin/import/staff/page';

describe('Staff account import permissions', () => {
  it('offers account import to an administrator', () => {
    mockRole = 'super_admin';
    render(<StaffImportPage />);
    expect(screen.getByRole('heading', { name: 'Import Staff' })).toBeInTheDocument();
  });
  it.each([
    'treasurer',
    'head_coach',
    'squad_coach',
    'welfare_officer',
    'competition_secretary',
    'parent',
    'member_adult',
    'member_minor',
  ])('does not offer account creation to %s', (role) => {
    mockRole = role;
    render(<StaffImportPage />);
    expect(
      screen.getByText('Only a club administrator can create staff accounts.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Import Staff' })).not.toBeInTheDocument();
  });
});
