import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

import { useClubRegion } from '@/hooks/useClubRegion';

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

describe('useClubRegion', () => {
  beforeEach(() => {
    mockGetMyClub.mockReset();
  });

  it('falls back to GB defaults when the API call fails', async () => {
    mockGetMyClub.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useClubRegion(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.country).toBe('GB');
    expect(result.current.currency).toBe('GBP');
    expect(result.current.timezone).toBe('Europe/London');
    expect(result.current.locale).toBe('en-GB');
    expect(result.current.countryName).toBe('United Kingdom');
    expect(result.current.postcodeLabel).toBe('Postcode');
    expect(result.current.countyLabel).toBe('County');
    expect(result.current.timezones).toEqual(['Europe/London']);
  });

  it('falls back to GB defaults when the API omits regional fields', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-1', name: 'Whitby Seals' });

    const { result } = renderHook(() => useClubRegion(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.country).toBe('GB');
    expect(result.current.currency).toBe('GBP');
    expect(result.current.timezone).toBe('Europe/London');
    expect(result.current.locale).toBe('en-GB');
  });

  it('resolves regional fields and bound labels for a US club', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-2',
      name: 'Austin Aquatics',
      country: 'US',
      currency: 'USD',
      timezone: 'America/Chicago',
      locale: 'en-US',
    });

    const { result } = renderHook(() => useClubRegion(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.country).toBe('US'));

    expect(result.current.currency).toBe('USD');
    expect(result.current.timezone).toBe('America/Chicago');
    expect(result.current.locale).toBe('en-US');
    expect(result.current.countryName).toBe('United States');
    expect(result.current.postcodeLabel).toBe('ZIP code');
    expect(result.current.countyLabel).toBe('State');
    expect(result.current.timezones[0]).toBe('America/New_York');
  });

  it('defaults the timezone to the country default when only the country is known', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-3', name: 'Sydney Sharks', country: 'AU' });

    const { result } = renderHook(() => useClubRegion(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.country).toBe('AU'));

    expect(result.current.timezone).toBe('Australia/Sydney');
    expect(result.current.countyLabel).toBe('State or territory');
  });
});
