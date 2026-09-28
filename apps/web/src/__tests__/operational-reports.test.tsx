import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OperationalReports from '@/components/admin/OperationalReports';
import {
  getOperationalReport,
  getReportRecords,
  downloadReport,
  formatReportMoney,
} from '@/lib/api/operational-reports';
import { getSquads } from '@/lib/api/squads';
jest.mock('@/lib/api/operational-reports', () => ({
  ...jest.requireActual('@/lib/api/operational-reports'),
  getOperationalReport: jest.fn(),
  getReportRecords: jest.fn(),
  downloadReport: jest.fn(),
}));
jest.mock('@/lib/api/squads', () => ({ getSquads: jest.fn() }));
const report = {
  definition_version: 'test',
  observed_at: '2026-09-19T12:00:00Z',
  timezone: 'Europe/London',
  from: '2026-09-01',
  to: '2026-09-19',
  occupancy: {
    assigned: 19,
    capacity: 30,
    rate_percent: 63.33,
    reserved: 2,
    unknown_capacity_classes: 1,
    assigned_without_capacity: 2,
    class_count: 3,
    definition: 'Current occupancy definition',
  },
  offers: {
    issued: 0,
    accepted: 0,
    resolved: 0,
    pending: 0,
    declined: 0,
    expired: 0,
    withdrawn: 0,
    rate_percent: null,
    resolved_rate_percent: null,
    definition: 'Offer definition',
  },
  invoiced: {
    status: 'available',
    totals: [{ currency: 'GBP', minor_units: '1030', count: 2 }],
    definition: 'Gross face value',
  },
  collected: { status: 'available', totals: [], definition: 'Confirmed only' },
  unavailable: [
    {
      id: 'retention',
      label: 'Retention',
      reason: 'Departure history is unavailable.',
      definition: 'Opening cohort',
      first_supported_date: null,
    },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  (getSquads as jest.Mock).mockResolvedValue([{ squad_id: 'class-1', squad_name: 'Test class' }]);
  (getOperationalReport as jest.Mock).mockResolvedValue(report);
  (getReportRecords as jest.Mock).mockResolvedValue({
    page: 1,
    total: 1,
    rows: [
      { id: 'class-1', label: 'Test class record', detail: '19 assigned', href: '/squads/class-1' },
    ],
  });
  (downloadReport as jest.Mock).mockResolvedValue(undefined);
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OperationalReports />
    </QueryClientProvider>
  );
  return userEvent.setup();
}
it('shows empty denominators and unavailable history without inventing zero rates', async () => {
  setup();
  expect(await screen.findByText('63.33%')).toBeInTheDocument();
  expect(screen.getByText('No eligible data')).toBeInTheDocument();
  expect(screen.getByText('Retention: unavailable')).toBeInTheDocument();
  expect(screen.getByText('GBP 10.30 (2 records)')).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Test class record' })).toHaveAttribute(
    'href',
    '/squads/class-1'
  );
});
it('uses the applied filters for summary, records and export', async () => {
  const user = setup();
  await screen.findByText('63.33%');
  await user.selectOptions(screen.getByLabelText('Class'), 'class-1');
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() =>
    expect(getOperationalReport).toHaveBeenLastCalledWith({
      from: '',
      to: '',
      squad_id: 'class-1',
      discipline: '',
    })
  );
  await user.click(screen.getByRole('button', { name: 'Export these records' }));
  expect(downloadReport).toHaveBeenCalledWith(
    { from: '', to: '', squad_id: 'class-1', discipline: '' },
    'occupancy'
  );
  expect(getReportRecords).toHaveBeenLastCalledWith(
    { from: '', to: '', squad_id: 'class-1', discipline: '' },
    'occupancy',
    1
  );
});
it('shows failure rather than misleading zero results', async () => {
  (getOperationalReport as jest.Mock).mockRejectedValue(Error('offline'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('Reports could not be loaded');
  expect(screen.queryByText('63.33%')).not.toBeInTheDocument();
});
it('prevents class-filtered money exports and surfaces failed exports', async () => {
  const user = setup();
  await screen.findByRole('link', { name: 'Test class record' });
  (downloadReport as jest.Mock).mockRejectedValue(Error('offline'));
  await user.click(screen.getByRole('button', { name: 'Export these records' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Export failed');
  await user.selectOptions(screen.getByLabelText('Class'), 'class-1');
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  await user.selectOptions(await screen.findByLabelText('Records'), 'collected');
  expect(screen.getByRole('button', { name: 'Export these records' })).toBeDisabled();
  expect(
    screen.getByText(/Class allocation is unavailable for family finances/)
  ).toBeInTheDocument();
});
it('formats exact minor units without losing large-integer precision', () => {
  expect(formatReportMoney('9007199254740993', 'GBP')).toBe('GBP 90,071,992,547,409.93');
  expect(formatReportMoney('-1', 'AUD')).toBe('AUD -0.01');
});
