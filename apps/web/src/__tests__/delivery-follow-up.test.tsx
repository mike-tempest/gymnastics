import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DeliveryFollowUp from '@/components/communications/DeliveryFollowUp';
import RecipientBadge from '@/components/communications/RecipientBadge';
import { api } from '@/lib/api/api-client';
import type { Communication } from '@/lib/api/communications';

let mockRole = 'head_coach';
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'staff', clubId: 'club', role: mockRole } } }),
}));
jest.mock('@/lib/api/api-client', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
const get = api.get as jest.Mock;
const post = api.post as jest.Mock;
const patch = api.patch as jest.Mock;
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeliveryFollowUp source="broadcast" sourceId="message" />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'head_coach';
});
it('distinguishes provider acceptance from evidenced delivery and offers retries only when safe', async () => {
  get.mockResolvedValue([
    {
      delivery_id: 'one',
      recipient_name: 'Family One',
      status: 'provider_accepted',
      retryable: false,
    },
    { delivery_id: 'two', recipient_name: 'Family Two', status: 'delivered', retryable: false },
    { delivery_id: 'three', recipient_name: 'Family Three', status: 'failed', retryable: true },
  ]);
  setup();
  await screen.findByText('Family One');
  expect(screen.getByText('Accepted by email provider')).toBeVisible();
  expect(screen.getByText('Delivered to recipient server')).toBeVisible();
  expect(screen.getAllByRole('button', { name: 'Retry email' })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Retry email' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/notification-deliveries/three/retry', {})
  );
});
it('saves manual follow-up and reports failed actions', async () => {
  get.mockResolvedValue([
    { delivery_id: 'one', recipient_name: 'Family One', status: 'suppressed', retryable: false },
  ]);
  patch.mockRejectedValueOnce(new Error('network'));
  setup();
  await screen.findByText('Family One');
  await userEvent.type(screen.getByRole('textbox'), 'Contacted by phone');
  await userEvent.click(screen.getByRole('button', { name: 'Save follow-up' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect(patch).toHaveBeenCalledWith('/notification-deliveries/one/follow-up', {
    note: 'Contacted by phone',
  });
});
it('does not fetch or show recipient details to parents', () => {
  mockRole = 'parent';
  setup();
  expect(get).not.toHaveBeenCalled();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
it('retries failed loading and pages through bounded recipient lists', async () => {
  get
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(
      Array.from({ length: 101 }, (_, i) => ({
        delivery_id: String(i),
        recipient_name: `Family ${i}`,
        status: 'queued',
        retryable: false,
      }))
    )
    .mockResolvedValueOnce([]);
  setup();
  await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
  await screen.findByText('Family 0');
  expect(screen.queryByText('Family 100')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'More recipients' }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      '/notification-deliveries?source_type=broadcast&source_id=message&page=1'
    )
  );
});

it.each(['all', 'squad', 'family'] as const)('renders the actual API recipient type %s', (type) => {
  render(<RecipientBadge communication={{ recipient_type: type } as Communication} />);
  expect(
    screen.getByText(type === 'all' ? 'All Families' : type === 'squad' ? 'Squad' : 'Family')
  ).toBeVisible();
});
