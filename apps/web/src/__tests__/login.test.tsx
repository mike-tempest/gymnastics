import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { signIn } from 'next-auth/react';

import LoginPage from '../app/(auth)/login/page';

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));

// Mock API auth functions
const mockLogin = jest.fn();
const mockStoreBackendToken = jest.fn();

jest.mock('@/lib/api/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

jest.mock('@/lib/api/api-client', () => ({
  storeBackendToken: (...args: unknown[]) => mockStoreBackendToken(...args),
}));

const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the login form with email and password fields', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the brand logo and subtitle', () => {
    render(<LoginPage />);

    expect(screen.getByRole('img', { name: 'Swimly' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
  });

  it('renders a link to the register page', () => {
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register');
  });

  it('shows validation error when email is empty on submit', async () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    const form = submitButton.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email format', async () => {
    render(<LoginPage />);

    fireEvent.input(screen.getByLabelText('Email Address'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.input(screen.getByLabelText('Password'), {
      target: { value: 'somepassword' },
    });
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('shows validation error when password is empty', async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('calls login and signIn with credentials on valid submission', async () => {
    mockLogin.mockResolvedValue({
      access_token: 'test-token',
      user: { user_id: '123', role: 'admin' },
    });
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: '/' });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'admin@swimclub.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'admin@swimclub.com',
        password: 'admin123',
      });
      expect(mockStoreBackendToken).toHaveBeenCalledWith('test-token');
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'admin@swimclub.com',
        password: 'admin123',
        redirect: false,
      });
    });
  });

  it('redirects to dashboard on successful login', async () => {
    mockLogin.mockResolvedValue({
      access_token: 'test-token',
      user: { user_id: '123', role: 'admin' },
    });
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: '/' });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'admin@swimclub.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('displays an error message when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'badpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
