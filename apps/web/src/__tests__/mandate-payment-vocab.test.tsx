import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

// Mock next/navigation (MandateSetup uses useRouter/useSearchParams)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
}));

// useClubRegion resolves the club's country from getMyClub
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

// Import after mocking
import { MandateSetup } from '@/components/mandates/MandateSetup';

function renderWithClub(country?: string, paymentProvider?: 'stripe' | 'gocardless' | null) {
  if (country) {
    mockGetMyClub.mockResolvedValue({
      id: 'club-1',
      name: 'Club',
      country,
      ...(paymentProvider !== undefined && { payment_provider: paymentProvider }),
    });
  } else {
    mockGetMyClub.mockRejectedValue(new Error('Not found'));
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<MandateSetup familyId="fam-1" />, { wrapper: Wrapper });
}

describe('MandateSetup payment vocabulary', () => {
  beforeEach(() => {
    mockGetMyClub.mockReset();
  });

  it('shows the exact UK Direct Debit copy for a GB club', async () => {
    renderWithClub('GB');

    await waitFor(() => expect(screen.getByText('Set Up Direct Debit')).toBeInTheDocument());

    expect(
      screen.getByText(
        'Set up a Direct Debit mandate to enable automatic monthly payments for swim club fees.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Secure and protected by the Direct Debit Guarantee')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Payments are processed securely through GoCardless, a UK regulated payment service provider.'
      )
    ).toBeInTheDocument();
  });

  it('uses ACH bank debit wording and generic protection copy for a US club', async () => {
    renderWithClub('US');

    await waitFor(() =>
      expect(screen.getByText('Set up your ACH bank debit mandate')).toBeInTheDocument()
    );

    expect(
      screen.getByText("Secure and protected by your country's bank debit scheme rules")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Payments are processed securely through GoCardless, a regulated payment service provider.'
      )
    ).toBeInTheDocument();

    // No UK-specific wording leaks into a US club's view.
    expect(screen.queryByText(/UK regulated/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Direct Debit Guarantee/)).not.toBeInTheDocument();
  });

  it('renders neutral Stripe copy when the club collects through Stripe', async () => {
    renderWithClub('GB', 'stripe');

    await waitFor(() => expect(screen.getByText('Set up automatic payments')).toBeInTheDocument());

    expect(
      screen.getByText(
        'You will be taken to a secure Stripe page to set up your payment method. Depending on your club, you can pay by bank debit or card.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Protected by your card scheme or bank debit scheme rules')
    ).toBeInTheDocument();
    expect(screen.getByText('Payments are processed securely through Stripe.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Stripe' })).toBeInTheDocument();

    // No scheme-specific direct-debit copy leaks into the Stripe flow.
    expect(screen.queryByText(/Direct Debit Guarantee/)).not.toBeInTheDocument();
    expect(screen.queryByText(/GoCardless/)).not.toBeInTheDocument();
  });

  it('keeps the exact UK Direct Debit copy when the club collects through GoCardless', async () => {
    renderWithClub('GB', 'gocardless');

    await waitFor(() => expect(screen.getByText('Set Up Direct Debit')).toBeInTheDocument());

    // Byte-identical GB regression bar: the Stripe work must not alter the
    // existing GoCardless direct-debit wording in any way.
    expect(
      screen.getByText(
        'Set up a Direct Debit mandate to enable automatic monthly payments for swim club fees.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Secure and protected by the Direct Debit Guarantee')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Payments are processed securely through GoCardless, a UK regulated payment service provider.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to GoCardless' })).toBeInTheDocument();
  });

  it('renders an informational state instead of setup when the club has no provider', async () => {
    // payment_provider: null from /clubs/me means the club has no active
    // payment connection: there is nothing to set up, so the component must
    // not offer a flow that could only fail.
    renderWithClub('GB', null);

    await waitFor(() =>
      expect(screen.getByText('Online payments are not available yet')).toBeInTheDocument()
    );

    expect(
      screen.getByText(
        'Your club has not set up online payments yet. You will be able to add a payment method here once they have. Contact the club if you have questions.'
      )
    ).toBeInTheDocument();

    // No setup entry point of any flavour.
    expect(screen.queryByRole('button', { name: 'Continue to Stripe' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue to GoCardless' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Set Up Direct Debit')).not.toBeInTheDocument();
  });

  it('does not flash the not-set-up message while the club is still loading', async () => {
    // A pending /clubs/me call must render the existing default copy, not
    // claim the club has no payments before the answer is known.
    mockGetMyClub.mockReturnValue(new Promise(() => undefined));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MandateSetup familyId="fam-1" />
      </QueryClientProvider>
    );

    expect(screen.queryByText('Online payments are not available yet')).not.toBeInTheDocument();
    expect(screen.getByText('Set Up Direct Debit')).toBeInTheDocument();
  });
});
