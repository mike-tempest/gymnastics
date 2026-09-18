import { TextEncoder } from 'util';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { signOut } from 'next-auth/react';

import { ApiError } from '@/lib/api/api-client';
import { requestPasswordReset, resetPassword } from '@/lib/api/password-recovery';

import ForgotPasswordPage from '../forgot-password/page';
import ResetPasswordPage from '../reset-password/page';

jest.mock('@/lib/api/password-recovery', () => ({
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
}));
jest.mock('next-auth/react', () => ({ signOut: jest.fn().mockResolvedValue(undefined) }));
Object.assign(global, { TextEncoder });
const requestReset = jest.mocked(requestPasswordReset);
const submitReset = jest.mocked(resetPassword);
function show(component: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      {component}
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, '', '/');
  localStorage.clear();
});

it('validates email and displays the neutral acknowledgement', async () => {
  requestReset.mockResolvedValue({
    message: 'If an active account matches, we will send a reset link.',
  });
  show(<ForgotPasswordPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('valid email');
  expect(requestReset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'parent@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('status')).toHaveTextContent('If an active account matches');
  expect(requestReset).toHaveBeenCalledWith('parent@example.com', expect.anything());
});

it('shows request throttling and keeps the form available', async () => {
  requestReset.mockRejectedValue(new ApiError('Too many requests', 429));
  show(<ForgotPasswordPage />);
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'parent@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('15 minutes');
  expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
});

it('handles a missing link and gives a recovery route', async () => {
  show(<ResetPasswordPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('missing or invalid');
  expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute(
    'href',
    '/forgot-password'
  );
  expect(submitReset).not.toHaveBeenCalled();
});

it('removes the link from the URL, validates matching passwords and clears local credentials on success', async () => {
  const token = 'a'.repeat(64);
  window.history.replaceState(null, '', `/reset-password#${token}`);
  localStorage.setItem('access_token', 'old-token');
  submitReset.mockResolvedValue({ message: 'Reset complete' });
  show(<ResetPasswordPage />);
  expect(window.location.hash).toBe('');
  fireEvent.change(await screen.findByLabelText('New password'), {
    target: { value: 'Replacement123' },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'Different123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Passwords must match');
  expect(submitReset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'Replacement123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  await waitFor(() => expect(submitReset).toHaveBeenCalledWith(token, 'Replacement123'));
  expect(await screen.findByRole('status')).toHaveTextContent('Your password has been reset');
  expect(localStorage.getItem('access_token')).toBeNull();
  expect(signOut).toHaveBeenCalledWith({ redirect: false });
});

it('shows an expired-link error without falsely reporting a successful reset', async () => {
  window.history.replaceState(null, '', `/reset-password#${'b'.repeat(64)}`);
  submitReset.mockRejectedValue(new ApiError('Invalid link', 400));
  show(<ResetPasswordPage />);
  fireEvent.change(await screen.findByLabelText('New password'), {
    target: { value: 'Replacement123' },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'Replacement123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid or has expired');
  expect(signOut).not.toHaveBeenCalled();
});
