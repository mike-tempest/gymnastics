import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { ReactNode } from 'react';

import SwimmerModal from '@/components/swimmers/SwimmerModal';

// useClubRegion reads the club's country from GET /clubs/me.
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

// The modal loads squads when it opens; keep it empty for these tests.
jest.mock('@/lib/api/squads', () => ({
  getSquads: jest.fn().mockResolvedValue([]),
}));

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <Wrapper>
      <SwimmerModal isOpen onClose={jest.fn()} onSubmit={jest.fn()} />
    </Wrapper>,
  );
}

function governingBodySelect(): HTMLSelectElement {
  return screen.getByLabelText(/Governing Body/i) as HTMLSelectElement;
}

describe('SwimmerModal governing-body region filtering', () => {
  beforeEach(() => {
    mockGetMyClub.mockReset();
  });

  it('offers only the GB governing bodies for a GB club', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-gb', name: 'Whitby Seals', country: 'GB' });

    renderModal();

    await waitFor(() => {
      const options = within(governingBodySelect()).getAllByRole('option');
      // Placeholder plus the four GB bodies.
      expect(options).toHaveLength(5);
    });

    const optionText = within(governingBodySelect())
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(optionText).toContain('Swim England');
    expect(optionText).toContain('Scottish Swimming');
    expect(optionText).toContain('Swim Wales');
    expect(optionText).toContain('British Gymnastics');
    expect(optionText).not.toContain('USA Swimming');
  });

  it('falls back to the GB governing bodies when the club country is unknown', async () => {
    mockGetMyClub.mockRejectedValue(new Error('Not found'));

    renderModal();

    await waitFor(() => {
      const options = within(governingBodySelect()).getAllByRole('option');
      expect(options).toHaveLength(5);
    });

    const optionText = within(governingBodySelect())
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(optionText).toContain('Swim England');
    expect(optionText).not.toContain('USA Swimming');
  });

  it('offers USA Swimming for a US club', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-us', name: 'Austin Aquatics', country: 'US' });

    renderModal();

    await waitFor(() => {
      const optionText = within(governingBodySelect())
        .getAllByRole('option')
        .map((o) => o.textContent);
      expect(optionText).toContain('USA Swimming');
    });

    const optionText = within(governingBodySelect())
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(optionText).not.toContain('Swim England');
  });

  it('keeps the generic registration label until a body is chosen, then uses the body-specific term', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-us', name: 'Austin Aquatics', country: 'US' });

    renderModal();

    // Default label before any body is selected.
    await waitFor(() => {
      expect(screen.getByText(/Registration Number/i)).toBeInTheDocument();
    });

    fireEvent.change(governingBodySelect(), { target: { value: 'USA_SWIMMING' } });

    await waitFor(() => {
      expect(screen.getByText(/USA Swimming ID/i)).toBeInTheDocument();
    });
  });
});
