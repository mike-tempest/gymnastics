import { API_BASE_URL, ApiError } from './api-client';

// Public requests deliberately omit any old sign-in token.
async function recoveryRequest(
  path: string,
  body: Record<string, string>
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new ApiError('Unable to process recovery request', response.status);
  return response.json();
}

export const requestPasswordReset = (email: string) =>
  recoveryRequest('forgot-password', { email });
export const resetPassword = (token: string, password: string) =>
  recoveryRequest('reset-password', { token, password });
