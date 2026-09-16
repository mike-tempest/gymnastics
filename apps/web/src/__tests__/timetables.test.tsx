import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TimetablePage from '@/app/sessions/timetable/page';
import { getSessions } from '@/lib/api/sessions';
import { getSquads } from '@/lib/api/squads';
import {
  createTimetable,
  editOccurrence,
  getTimetables,
  previewTimetable,
} from '@/lib/api/timetables';

let mockRole = 'super_admin';
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: mockRole } } }),
}));
jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/lib/api/sessions', () => ({ getSessions: jest.fn() }));
jest.mock('@/lib/api/squads', () => ({ getSquads: jest.fn() }));
jest.mock('@/lib/api/timetables', () => ({
  getTimetables: jest.fn(),
  createTimetable: jest.fn(),
  previewTimetable: jest.fn(),
  editOccurrence: jest.fn(),
}));
const squadId = '8c044e33-1cdd-4ab2-9a42-f672d5a35e0a';
const slot = {
  squad_id: squadId,
  session_name: 'Monday training',
  weekday: 1,
  start_time: '17:00',
  end_time: '18:00',
  excluded_dates: [],
};
function setup() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TimetablePage />
    </QueryClientProvider>
  );
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'super_admin';
  Object.defineProperty(global.crypto, 'randomUUID', {
    configurable: true,
    value: () => '1aeab0b0-e4df-45b1-ab99-72335c4e40cf',
  });
  Element.prototype.scrollIntoView = jest.fn();
  (getTimetables as jest.Mock).mockResolvedValue([]);
  (getSquads as jest.Mock).mockResolvedValue([{ squad_id: squadId, squad_name: 'Recreational' }]);
  (getSessions as jest.Mock).mockResolvedValue([]);
  (createTimetable as jest.Mock).mockResolvedValue({ term_id: 'term' });
  (previewTimetable as jest.Mock).mockResolvedValue({
    timezone: 'Europe/London',
    preview_token: 'token',
    can_commit: true,
    rows: [
      {
        definition: slot,
        squad_name: 'Recreational',
        dates: ['2027-03-01'],
        scheduled: ['2027-03-01'],
        occupied: 1,
        capacity: 2,
        places: 1,
      },
    ],
  });
});
it('requires a preview then a separate confirmation, and invalidates the preview after edits', async () => {
  setup();
  await screen.findByRole('option', { name: 'Recreational' });
  change('Term name', 'Spring');
  change('First date', '2027-03-01');
  change('Last date', '2027-03-31');
  change('Session name', 'Monday training');
  change('Squad', squadId);
  fireEvent.click(screen.getByRole('button', { name: 'Preview timetable' }));
  await screen.findByRole('button', { name: 'Confirm timetable' });
  expect(createTimetable).not.toHaveBeenCalled();
  change('Term name', 'Spring updated');
  expect(screen.queryByRole('button', { name: 'Confirm timetable' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Preview timetable' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm timetable' }));
  await waitFor(() =>
    expect(createTimetable).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Spring updated',
        preview_token: 'token',
        operation_id: expect.any(String),
      })
    )
  );
  await screen.findByText(/Timetable saved/);
});
it('blocks confirmation when the capacity preview is over full', async () => {
  (getTimetables as jest.Mock).mockResolvedValue([
    {
      term_id: 'old',
      name: 'Spring',
      start_date: '2027-03-01',
      end_date: '2027-03-31',
      timezone: 'Europe/London',
      series: [{ series_id: 'series', definition: slot }],
    },
  ]);
  (previewTimetable as jest.Mock).mockResolvedValue({
    timezone: 'Europe/London',
    preview_token: 'token',
    can_commit: false,
    rows: [],
  });
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Roll over Spring' }));
  change('Term name', 'Summer');
  change('First date', '2027-04-01');
  change('Last date', '2027-04-30');
  fireEvent.click(screen.getByRole('button', { name: 'Preview timetable' }));
  expect(await screen.findByRole('button', { name: 'Confirm timetable' })).toBeDisabled();
  expect(previewTimetable).toHaveBeenCalledWith(
    expect.objectContaining({ source_term_id: 'old', series: [slot] })
  );
  expect(createTimetable).not.toHaveBeenCalled();
});
it('submits explicit future scope and reports preserved historical sessions', async () => {
  (getTimetables as jest.Mock).mockResolvedValue([
    {
      term_id: 'term',
      name: 'Spring',
      start_date: '2027-03-01',
      end_date: '2027-03-31',
      timezone: 'Europe/London',
      series: [{ series_id: 'series', definition: slot }],
    },
  ]);
  (getSessions as jest.Mock).mockResolvedValue([
    {
      session_id: 'session',
      series_id: 'series',
      session_date: '2027-03-01',
      start_time: '17:00',
      status: 'scheduled',
    },
  ]);
  (editOccurrence as jest.Mock).mockResolvedValue({
    updated: 3,
    skipped: [{ session_id: 'old', date: '2027-03-01', reason: 'History or attendance recorded' }],
  });
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Monday training' }));
  change('Session to change', 'session');
  change('Start time', '16:30');
  fireEvent.click(screen.getByRole('button', { name: 'Save session changes' }));
  await screen.findByText(/3 sessions updated. 1 kept unchanged/);
  expect(editOccurrence).toHaveBeenCalledWith(
    'session',
    expect.objectContaining({
      scope: 'future',
      definition: expect.objectContaining({ start_time: '16:30' }),
    })
  );
});
it('does not load club timetables for a parent', () => {
  mockRole = 'parent';
  setup();
  expect(screen.queryByRole('button', { name: 'Preview timetable' })).not.toBeInTheDocument();
  expect(getTimetables).not.toHaveBeenCalled();
});
