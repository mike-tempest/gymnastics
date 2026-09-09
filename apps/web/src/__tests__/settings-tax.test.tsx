import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/admin/settings',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockGetClubSettings = jest.fn();
const mockUpdateClubSettings = jest.fn();
jest.mock('@/lib/api/settings', () => ({
  getClubSettings: (...args: unknown[]) => mockGetClubSettings(...args),
  updateClubSettings: (...args: unknown[]) => mockUpdateClubSettings(...args),
}));

// Bare club payload resolves useClubRegion to GB defaults.
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

import SettingsPage from '../app/admin/settings/page';

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const baseSettings = {
  settings_id: 's1',
  club_name: 'Whitby Seals',
  address: null,
  contact_email: null,
  phone: null,
  website: null,
  logo_url: null,
  swim_england: {},
  locations: [],
  billing_config: {},
  notification_prefs: {},
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

describe('SettingsPage Tax card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyClub.mockResolvedValue({ id: 'club-1', name: 'Whitby Seals' });
    mockGetClubSettings.mockResolvedValue(baseSettings);
    mockUpdateClubSettings.mockResolvedValue(baseSettings);
  });

  it('sends tax_rate and tax_label when saving the Tax card', async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tax rate (%)')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Tax rate (%)'), '20');
    await user.type(screen.getByLabelText('Tax name'), 'VAT');

    const taxCard = screen.getByLabelText('Tax rate (%)').closest('div.mb-8') as HTMLElement;
    const saveButton = within(taxCard).getByRole('button', { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      // The tax card also saves the inclusive flag and registration number
      // introduced with GST support; untouched fields keep their defaults.
      expect(mockUpdateClubSettings).toHaveBeenCalledWith({
        tax_rate: 20,
        tax_label: 'VAT',
        tax_inclusive: false,
        tax_registration_number: null,
      });
    });
  });

  it('rejects an out-of-range tax rate without calling the API', async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tax rate (%)')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Tax rate (%)'), '250');

    const taxCard = screen.getByLabelText('Tax rate (%)').closest('div.mb-8') as HTMLElement;
    const saveButton = within(taxCard).getByRole('button', { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Tax rate must be a number between 0 and 100')).toBeInTheDocument();
    });
    expect(mockUpdateClubSettings).not.toHaveBeenCalled();
  });

  it('sends null tax_rate and tax_label when the fields are cleared', async () => {
    mockGetClubSettings.mockResolvedValue({
      ...baseSettings,
      tax_rate: 20,
      tax_label: 'VAT',
    });

    const user = userEvent.setup();
    renderWithClient(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tax rate (%)')).toHaveValue(20);
    });

    await user.clear(screen.getByLabelText('Tax rate (%)'));
    await user.clear(screen.getByLabelText('Tax name'));

    const taxCard = screen.getByLabelText('Tax rate (%)').closest('div.mb-8') as HTMLElement;
    const saveButton = within(taxCard).getByRole('button', { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateClubSettings).toHaveBeenCalledWith({
        tax_rate: null,
        tax_label: null,
        tax_inclusive: false,
        tax_registration_number: null,
      });
    });
  });
});
