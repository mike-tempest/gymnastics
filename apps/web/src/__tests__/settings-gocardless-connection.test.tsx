import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { GoCardlessConnectionCard } from '@/components/settings/GoCardlessConnectionCard';
import * as api from '@/lib/api/payments-connection';

jest.mock('@/lib/api/payments-connection');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/utils/browser-navigation', () => ({ redirectTo: jest.fn() }));
const active = {
  configured: true,
  provider: 'gocardless' as const,
  status: 'active' as const,
  livemode: false,
  external_account_id: 'OR1',
  capabilities: null,
};
const mount = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <GoCardlessConnectionCard />
    </QueryClientProvider>
  );
beforeEach(() => {
  jest.resetAllMocks();
  window.history.replaceState({}, '', '/admin/settings');
  (api.getGoCardlessConnection as jest.Mock).mockResolvedValue(active);
});
it('cleans OAuth credentials from the URL and exchanges them once', async () => {
  window.history.replaceState({}, '', '/admin/settings?code=secret-code&state=opaque-state');
  (api.completeGoCardlessConnect as jest.Mock).mockResolvedValue(active);
  mount();
  await waitFor(() => expect(api.completeGoCardlessConnect).toHaveBeenCalledTimes(1));
  expect(api.completeGoCardlessConnect).toHaveBeenCalledWith('secret-code', 'opaque-state');
  expect(window.location.search).toBe('');
  expect(await screen.findByText(/Sandbox connection/)).toBeInTheDocument();
});
it('requires an explicit disconnect action and preserves the account on cancel', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Disconnect GoCardless' }));
  expect(api.disconnectGoCardlessConnection).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep connected' }));
  expect(screen.queryByRole('button', { name: 'Confirm disconnection' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect GoCardless' }));
  (api.disconnectGoCardlessConnection as jest.Mock).mockResolvedValue({
    ...active,
    status: 'disconnected',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnection' }));
  await waitFor(() => expect(api.disconnectGoCardlessConnection).toHaveBeenCalledTimes(1));
});
it('shows failed reads as retryable errors rather than an unconfigured account', async () => {
  (api.getGoCardlessConnection as jest.Mock).mockRejectedValue(new Error('offline'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not check');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  expect(screen.queryByText(/not yet enabled/)).not.toBeInTheDocument();
});
it('shows imported references that do not belong to the connected account', async () => {
  (api.reconcileGoCardlessMandates as jest.Mock).mockResolvedValue({
    results: [{ mandate_id: 'local1', provider_mandate_id: 'MD_OTHER', status: 'not_in_account' }],
  });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Check imported mandates' }));
  expect(await screen.findByText(/MD_OTHER: Not found/)).toBeInTheDocument();
});
