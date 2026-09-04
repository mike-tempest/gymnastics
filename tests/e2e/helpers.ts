import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export const API_BASE = process.env.API_BASE_URL || 'https://membership-api-production-3628.up.railway.app/api';
export const WEB_BASE = process.env.WEB_BASE_URL || 'https://web-app-production-7a4c.up.railway.app';

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@rtwmonson.co.uk';
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Demo2024!';
export const COACH_EMAIL = process.env.TEST_COACH_EMAIL || 'sarah.mitchell@rtwmonson.co.uk';
export const COACH_PASSWORD = process.env.TEST_COACH_PASSWORD || 'Demo2024!';
export const PARENT_EMAIL = process.env.TEST_PARENT_EMAIL || 'sarah.johnson@gmail.com';
export const PARENT_PASSWORD = process.env.TEST_PARENT_PASSWORD || 'Demo2024!';

/** Login and return an access token */
export async function loginAs(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

/** Make an authenticated GET request */
export async function authGet(path: string, token: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Make an authenticated POST request */
export async function authPost(path: string, token: string, body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Make an authenticated PATCH request */
export async function authPatch(path: string, token: string, body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Make an authenticated DELETE request */
export async function authDelete(path: string, token: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
