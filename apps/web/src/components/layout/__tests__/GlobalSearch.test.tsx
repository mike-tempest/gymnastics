import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { api } from '@/lib/api/api-client';

import GlobalSearch from '../GlobalSearch';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u', clubId: 'c', role: 'super_admin' } } }),
}));
jest.mock('@/lib/api/api-client', () => ({ api: { get: jest.fn() } }));
const get = jest.mocked(api.get);
function show() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <GlobalSearch />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
});
it('opens an accessible search and navigates the chosen result with the keyboard', async () => {
  get.mockResolvedValue({
    results: [
      { id: 'a', kind: 'member', title: 'Ada Smith', detail: 'Ref abc', href: '/members/a' },
    ],
    truncated: false,
  });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Search club records' }));
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Ada' } });
  expect(await screen.findByRole('option')).toHaveTextContent('Ada Smith');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(push).toHaveBeenCalledWith('/members/a');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('shows a failed search and lets the user retry', async () => {
  get
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ results: [], truncated: false });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Search club records' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Ada' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('could not load');
  fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No matching records'));
});
it('does not search for one character and removes stale results while typing', async () => {
  get.mockResolvedValue({
    results: [{ id: 'a', kind: 'family', title: 'Smith', href: '/families/a' }],
    truncated: false,
  });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Search club records' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'S' } });
  expect(get).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Smith' } });
  await screen.findByRole('option');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Jones' } });
  expect(screen.queryByRole('option')).not.toBeInTheDocument();
});
