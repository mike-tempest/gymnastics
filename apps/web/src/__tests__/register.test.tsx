import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { signIn } from 'next-auth/react';

import RegisterPage from '../app/(auth)/register/page';

// Mock next/navigation
const mockPush = jest.fn();
const mockGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));

// Mock API auth functions
const mockRegisterUser = jest.fn();
const mockStoreBackendToken = jest.fn();

jest.mock('@/lib/api/auth', () => ({
  registerUser: (...args: unknown[]) => mockRegisterUser(...args),
}));

jest.mock('@/lib/api/api-client', () => ({
  storeBackendToken: (...args: unknown[]) => mockStoreBackendToken(...args),
}));

// Mock families API
jest.mock('@/lib/api/families', () => ({
  acceptInvite: jest.fn(),
}));

const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockGet.mockReturnValue('a'.repeat(64));
  });

  it('renders the registration form with all fields', () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.queryByLabelText('I am a...')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders the brand logo and subtitle', () => {
    render(<RegisterPage />);

    // The logo is decorative (empty alt) until the placeholder artwork is
    // replaced with the real brand's wordmark.
    expect(document.querySelector('img[alt=""]')).toBeInTheDocument();
    expect(screen.getByText('Create your account')).toBeInTheDocument();
  });

  it('renders a link to the login page', () => {
    render(<RegisterPage />);

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('offers club signup and sign-in without an invitation', () => {
    mockGet.mockReturnValue(null);
    render(<RegisterPage />);
    expect(screen.getByRole('link', { name: /set up a new club/i })).toHaveAttribute(
      'href',
      '/create-club'
    );
    expect(screen.getByText(/need an invitation from their club/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it('shows validation errors when submitting an empty form', async () => {
    render(<RegisterPage />);

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Please enter your first name')).toBeInTheDocument();
      expect(screen.getByText('Please enter your last name')).toBeInTheDocument();
      expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
    });
  });

  it('shows password mismatch error when passwords differ', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'differentpassword' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Passwords do not match. Please re-enter your password.')
      ).toBeInTheDocument();
    });
  });

  it('shows error when password is too short', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
    });
  });

  it('calls the registerUser API on valid submission', async () => {
    mockRegisterUser.mockResolvedValue({
      access_token: 'test-token',
      user: { user_id: '1', email: 'jane@example.com' },
    });
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: '/' });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'password123',
        first_name: 'Jane',
        last_name: 'Doe',
        invite_token: 'a'.repeat(64),
      });
      expect(mockStoreBackendToken).toHaveBeenCalledWith('test-token');
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'jane@example.com',
        password: 'password123',
        redirect: false,
      });
    });
  });

  it('shows the success screen after registration', async () => {
    mockRegisterUser.mockResolvedValue({
      access_token: 'test-token',
      user: { user_id: '1' },
    });
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: '/' });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Account Created')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute(
        'href',
        '/login'
      );
    });
  });

  it('displays an API error message on registration failure', async () => {
    mockRegisterUser.mockRejectedValue(new Error('Email already in use'));

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already in use')).toBeInTheDocument();
    });
  });
});
