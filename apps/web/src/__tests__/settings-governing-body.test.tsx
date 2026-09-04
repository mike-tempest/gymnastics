import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

// Mock next/navigation (settings page pulls it in transitively via layout bits)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => '/admin/settings',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// Keep the layout out of the way so the test focuses on the settings sections.
jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Mock the settings API
const mockGetClubSettings = jest.fn();
const mockUpdateClubSettings = jest.fn();
jest.mock('@/lib/api/settings', () => ({
  getClubSettings: (...args: unknown[]) => mockGetClubSettings(...args),
  updateClubSettings: (...args: unknown[]) => mockUpdateClubSettings(...args),
}));

// Mock the clubs API so useClubRegion resolves a controllable country.
const mockGetMyClub = jest.fn();
jest.mock('@/lib/api/clubs', () => ({
  getMyClub: (...args: unknown[]) => mockGetMyClub(...args),
}));

import SettingsPage from '../app/admin/settings/page';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const baseSettings = {
  settings_id: 'set-1',
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

describe('SettingsPage governing body section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClubSettings.mockResolvedValue(baseSettings);
  });

  it('shows the Swim England heading for a GB club', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-1', country: 'GB' });

    render(<SettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Swim England' })).toBeInTheDocument();
    });

    // GB shows the governing-body picker (three bodies) and the SE region select.
    expect(screen.getByLabelText('Governing body')).toBeInTheDocument();
    const region = screen.getByLabelText('Region') as HTMLSelectElement;
    expect(region.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'South West' })).toBeInTheDocument();
    expect(screen.getByLabelText('County')).toBeInTheDocument();
  });

  it('shows the USA Swimming heading and free-text region for a US club', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-2', country: 'US' });

    render(<SettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'USA Swimming' })).toBeInTheDocument();
    });

    // Single-body country hides the picker and uses a free-text region input.
    expect(screen.queryByLabelText('Governing body')).not.toBeInTheDocument();
    const region = screen.getByLabelText('Region') as HTMLInputElement;
    expect(region.tagName).toBe('INPUT');
    // County is Swim England specific and should not render for US.
    expect(screen.queryByLabelText('County')).not.toBeInTheDocument();
  });

  it('shows a state/territory dropdown for an Australian club', async () => {
    mockGetMyClub.mockResolvedValue({
      id: 'club-au',
      country: 'AU',
      governing_body: 'SWIMMING_AUSTRALIA',
      governing_body_region: 'NSW',
    });

    render(<SettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Swimming Australia' })).toBeInTheDocument();
    });

    const region = screen.getByLabelText('State or territory') as HTMLSelectElement;
    expect(region.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Western Australia' })).toHaveValue('WA');
    expect(screen.getByRole('option', { name: 'Tasmania' })).toHaveValue('TAS');
    // County is Swim England specific and should not render for AU.
    expect(screen.queryByLabelText('County')).not.toBeInTheDocument();
  });

  it('lets a GB club switch governing body and updates the heading and region control', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-1', country: 'GB' });

    render(<SettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Swim England' })).toBeInTheDocument();
    });

    const picker = screen.getByLabelText('Governing body') as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: 'SCOTTISH_SWIMMING' } });

    // The select is controlled by the same state the heading derives from, so
    // the new choice sticks without a save round-trip, the heading follows it,
    // and the region control becomes free text.
    expect(picker.value).toBe('SCOTTISH_SWIMMING');
    expect(screen.getByRole('heading', { name: 'Scottish Swimming' })).toBeInTheDocument();
    expect((screen.getByLabelText('Region') as HTMLElement).tagName).toBe('INPUT');
    expect(screen.queryByLabelText('County')).not.toBeInTheDocument();
  });

  it('populates the affiliation number from the legacy swim_england shape', async () => {
    mockGetMyClub.mockResolvedValue({ id: 'club-1', country: 'GB' });
    mockGetClubSettings.mockResolvedValue({
      ...baseSettings,
      swim_england: { affiliationNumber: 'SE-9999', region: 'London', county: 'Greater London' },
    });

    render(<SettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Affiliation Number')).toHaveValue('SE-9999');
    });
    expect(screen.getByLabelText('Region')).toHaveValue('London');
    expect(screen.getByLabelText('County')).toHaveValue('Greater London');
  });
});
