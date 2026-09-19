import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';

import ReportsPage from '@/app/admin/reports/page';

jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/admin/OperationalReports', () => ({
  __esModule: true,
  default: () => <div>Operational report</div>,
}));
jest.mock('@/hooks/useClubRegion', () => ({
  useClubRegion: () => ({ club: { name: 'Test Club' } }),
}));
jest.mock('@/hooks/useFormatters', () => ({
  useFormatters: () => ({ formatDate: () => '19/09/2026' }),
}));
jest.mock('@/lib/api/admin', () => ({
  getAdminDashboard: jest
    .fn()
    .mockResolvedValue({
      membership: { activeMembers: 1 },
      revenue: { collectionRate: 0 },
      revenueChart: [],
    }),
}));
jest.mock('@/lib/api/reports', () => ({
  getAdminReports: jest
    .fn()
    .mockResolvedValue({
      weeklyAttendanceTrend: [],
      squadAttendanceRates: [],
      topAbsentees: [],
      newJoiners: [],
      leavers: null,
      leaversUnavailableReason: 'Departure history is unavailable.',
      squadDistribution: [],
    }),
}));
jest.mock('@/lib/api/finance', () => ({
  getInvoices: jest
    .fn()
    .mockResolvedValue([
      {
        invoice_id: 'i',
        invoice_number: 'TEST',
        total_amount: '7.20',
        due_date: '2026-09-20',
        family: { family_name: 'Test Family' },
      },
    ]),
}));
it('renders decimal-string invoice totals and never calls missing departures zero', async () => {
  render(<ReportsPage />);
  expect(await screen.findByText('Operational report')).toBeInTheDocument();
  expect(screen.getAllByText(/7.20/).length).toBeGreaterThan(0);
  expect(screen.getByText('Departure history is unavailable.')).toBeInTheDocument();
  expect(screen.queryByText('No leavers this month.')).not.toBeInTheDocument();
});
