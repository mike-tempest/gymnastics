import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  signIn: jest.fn().mockResolvedValue({ error: null, ok: true, status: 200, url: '/' }),
}));

// Mock analytics so the funnel calls are no-ops.
jest.mock('@/lib/analytics', () => ({
  signinAfterSignupFailed: jest.fn(),
  signupFailed: jest.fn(),
  signupStarted: jest.fn(),
  signupSubmitted: jest.fn(),
  signupSucceeded: jest.fn(),
}));

const mockRegisterClub = jest.fn();
const mockStoreBackendToken = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  registerClub: (...args: unknown[]) => mockRegisterClub(...args),
}));
jest.mock('@/lib/api/api-client', () => ({
  storeBackendToken: (...args: unknown[]) => mockStoreBackendToken(...args),
}));

import CreateClubPage from '../app/(auth)/create-club/page';

function fillAdminAccount() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Doe' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'jane@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
}

describe('CreateClubPage governing body', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockRegisterClub.mockResolvedValue({
      access_token: 'test-token',
      user: { user_id: '1', club_id: 'club-1' },
    });
  });

  it('shows the governing body picker and a Swim England region select for GB (the default)', () => {
    render(<CreateClubPage />);

    // GB has three bodies, so the picker renders and defaults to Swim England.
    const bodyPicker = screen.getByLabelText('Governing body') as HTMLSelectElement;
    expect(bodyPicker.value).toBe('SWIM_ENGLAND');
    expect(screen.getByRole('option', { name: 'Scottish Swimming' })).toBeInTheDocument();

    // Region is the Swim England 7-option select.
    const region = screen.getByLabelText(/Region/) as HTMLSelectElement;
    expect(region.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'South West' })).toBeInTheDocument();
  });

  it('hides the picker and uses a free-text region for a single-body country', () => {
    render(<CreateClubPage />);

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'US' } });

    expect(screen.queryByLabelText('Governing body')).not.toBeInTheDocument();
    const region = screen.getByLabelText(/Region/) as HTMLInputElement;
    expect(region.tagName).toBe('INPUT');
  });

  it('shows a state/territory dropdown storing the state code for an AU club', () => {
    render(<CreateClubPage />);

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'AU' } });

    // The address county field is also relabelled "State or territory" for AU,
    // so target the governing-body region select by role.
    const region = screen.getByRole('combobox', { name: /State or territory/ }) as HTMLSelectElement;
    expect(region.tagName).toBe('SELECT');
    // All eight states and territories, stored by code.
    expect(screen.getByRole('option', { name: 'New South Wales' })).toHaveValue('NSW');
    expect(screen.getByRole('option', { name: 'Queensland' })).toHaveValue('QLD');
    expect(screen.getByRole('option', { name: 'Northern Territory' })).toHaveValue('NT');

    fireEvent.change(region, { target: { value: 'QLD' } });
    expect(region.value).toBe('QLD');
  });

  it('submits both the new governing-body keys and the legacy keys', async () => {
    render(<CreateClubPage />);

    fireEvent.change(screen.getByLabelText('Club name'), { target: { value: 'Whitby Seals' } });
    fireEvent.change(screen.getByLabelText(/Region/), { target: { value: 'London' } });
    fireEvent.change(screen.getByLabelText(/Affiliate number/), { target: { value: 'SE-1234' } });
    fillAdminAccount();

    fireEvent.click(screen.getByRole('button', { name: /create club/i }));

    await waitFor(() => {
      expect(mockRegisterClub).toHaveBeenCalled();
    });

    const payload = mockRegisterClub.mock.calls[0][0];
    expect(payload.club.governing_body).toBe('SWIM_ENGLAND');
    expect(payload.club.governing_body_region).toBe('London');
    expect(payload.club.affiliation_number).toBe('SE-1234');
    // Legacy keys still sent for the pre-affiliation-backend API.
    expect(payload.club.swim_england_region).toBe('London');
    expect(payload.club.affiliate_number).toBe('SE-1234');
  });
});
