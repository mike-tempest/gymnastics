import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

import { useFormatters } from '@/hooks/useFormatters';

const mockGetMyClub = jest.fn();

jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFormatters', () => {
  beforeEach(() => {
    mockGetMyClub.mockReset();
  });

  it('produces the previous UK output while the region is unavailable', async () => {
    mockGetMyClub.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useFormatters(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.formatCurrency(1250)).toBe('£1,250.00'));
    expect(result.current.formatDate('2026-07-09T12:00:00Z')).toBe('9 Jul 2026');
  });

  it('binds to a US club region and honours a currency override', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-2',
      name: 'Austin Aquatics',
      country: 'US',
      currency: 'USD',
      timezone: 'America/Chicago',
      locale: 'en-US',
    });

    const { result } = renderHook(() => useFormatters(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.formatCurrency(1250)).toBe('$1,250.00'));
    expect(result.current.formatCurrency(1250, 'CAD')).toBe('CA$1,250.00');
    expect(result.current.formatDate('2026-07-09T12:00:00Z')).toBe('Jul 9, 2026');
    expect(
      result.current.formatDateTime('2026-07-09T17:00:00Z', {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    ).toBe('12:00');
  });
});
