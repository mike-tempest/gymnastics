import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api';
export const WEB_BASE = process.env.WEB_BASE_URL || 'http://localhost:3000';

// Defaults are the demo gymnastics club (docs/demos/gym-demo-club.md). Seed it
// into a local database before running this suite.
export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@kestrelvalegym.org.uk';
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Demo2024!';
export const COACH_EMAIL = process.env.TEST_COACH_EMAIL || 'rachel.oduya@kestrelvalegym.org.uk';
export const COACH_PASSWORD = process.env.TEST_COACH_PASSWORD || 'Demo2024!';
export const PARENT_EMAIL = process.env.TEST_PARENT_EMAIL || 'claire.ashworth@example.com';
export const PARENT_PASSWORD = process.env.TEST_PARENT_PASSWORD || 'Demo2024!';

/**
 * Row counts the demo gymnastics club seeds
 * (services/membership/src/seed/gym-demo-seed.ts). Assertions use them as a
 * lower bound rather than an exact match: Jest runs these files in parallel
 * and the CRUD suite creates and deletes records while the others count.
 */
export const DEMO_COUNTS = {
  users: 13, // 5 staff plus 8 parents
  members: 16,
  squads: 8,
  sessions: 90, // 15 weekly templates over 6 weeks
  families: 8,
  feeStructures: 10, // one per squad, plus club membership and the badge fee
  invoices: 8, // one per family
};

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
