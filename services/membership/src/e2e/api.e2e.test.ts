/**
 * End-to-end tests for the membership API.
 *
 * These run against a locally running API backed by a database seeded with the
 * demo gymnastics club (docs/demos/gym-demo-club.md). Seed the club first, or
 * every authenticated test fails at login.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:3001 npm run test:e2e
 */

import * as dotenv from 'dotenv';
import { join } from 'path';

// Load test environment variables
dotenv.config({ path: join(__dirname, '../../../../.env.test') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Demo club credentials, overridable for a differently seeded database.
const VALID_CREDENTIALS = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@kestrelvalegym.org.uk',
  password: process.env.TEST_ADMIN_PASSWORD || 'Demo2024!',
};

const INVALID_CREDENTIALS = {
  email: 'invalid@example.com',
  password: 'WrongPassword123',
};

/**
 * Row counts the demo gymnastics club seeds. They live in one place because
 * they track src/seed/gym-demo-seed.ts: change the seed, change these.
 */
const DEMO_COUNTS = {
  users: 13, // 5 staff plus 8 parents
  members: 16,
  squads: 8,
  sessions: 90, // 15 weekly templates over 6 weeks
  families: 8,
  feeStructures: 10, // one per squad, plus club membership and the badge fee
  invoices: 8, // one per family
};

// Shared authentication token
let authToken: string;

/**
 * Helper function to make API requests
 */
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Helper function to make authenticated API requests
 */
async function authenticatedRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  return apiRequest(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${authToken}`,
    },
  });
}

describe('Membership API E2E Tests', () => {
  describe('Authentication Endpoints', () => {
    it('should successfully log in with valid credentials', async () => {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(VALID_CREDENTIALS),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as { access_token?: string };
      expect(JSON.stringify(data)).not.toContain('password_hash');
      expect(data).toHaveProperty('access_token');
      expect(typeof data.access_token).toBe('string');

      // Save token for subsequent tests
      authToken = data.access_token!;
    });

    it('should reject login with invalid credentials', async () => {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(INVALID_CREDENTIALS),
      });

      expect(response.status).toBe(401);
    });

    it('should validate registration input', async () => {
      const response = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          password: '123',
        }),
      });

      // Should fail validation (400) or conflict (409) if already exists
      expect([400, 409]).toContain(response.status);
    });

    it('should return user profile with valid token', async () => {
      const response = await authenticatedRequest('/api/auth/profile');

      expect(response.status).toBe(200);

      const data = (await response.json()) as { email?: string };
      expect(data).toHaveProperty('email');
      expect(data.email).toBe(VALID_CREDENTIALS.email);
    });

    it('should reject profile request without token', async () => {
      const response = await apiRequest('/api/auth/profile');

      expect(response.status).toBe(401);
    });
  });

  describe('Users Endpoints', () => {
    it('should return every user in the club', async () => {
      const response = await authenticatedRequest('/api/users');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(DEMO_COUNTS.users);
    });
  });

  describe('Members Endpoints', () => {
    it('should return every member in the club', async () => {
      const response = await authenticatedRequest('/api/members');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(DEMO_COUNTS.members);
    });
  });

  describe('Squads Endpoints', () => {
    it('should return every squad in the club', async () => {
      const response = await authenticatedRequest('/api/squads');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(DEMO_COUNTS.squads);
    });
  });

  describe('Sessions Endpoints', () => {
    it('should return every session in the club', async () => {
      const response = await authenticatedRequest('/api/sessions');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(DEMO_COUNTS.sessions);
    });
  });

  describe('Attendance Endpoints', () => {
    it('should return attendance array', async () => {
      const response = await authenticatedRequest('/api/attendance');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Families Endpoints', () => {
    it('should return every family in the club', async () => {
      const response = await authenticatedRequest('/api/families');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(DEMO_COUNTS.families);
    });
  });

  describe('Finance Endpoints', () => {
    it('should return every fee structure in the club', async () => {
      const response = await authenticatedRequest('/api/fee-structures');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(DEMO_COUNTS.feeStructures);
    });

    it('should return every invoice in the club', async () => {
      const response = await authenticatedRequest('/api/invoices');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(DEMO_COUNTS.invoices);
    });

    it('should return payments array', async () => {
      const response = await authenticatedRequest('/api/payments');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return mandates array', async () => {
      const response = await authenticatedRequest('/api/mandates');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Compliance Endpoints', () => {
    it('should return DBS checks array', async () => {
      const response = await authenticatedRequest('/api/compliance/dbs');

      expect(response.status).toBe(200);

      const data = (await response.json()) as Array<{ user?: { email?: string } }>;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data.some((check) => check.user?.email)).toBe(true);
      expect(JSON.stringify(data)).not.toContain('password_hash');
    });

    it('should return consents array', async () => {
      const response = await authenticatedRequest('/api/compliance/consents');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return audit logs array', async () => {
      const response = await authenticatedRequest('/api/compliance/audit-logs');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return safeguarding checklist', async () => {
      const response = await authenticatedRequest('/api/compliance/safeguarding/checklist');

      expect(response.status).toBe(200);

      const data = (await response.json()) as Record<string, unknown>;
      expect(typeof data).toBe('object');
    });

    it('should return safeguarding officers array', async () => {
      const response = await authenticatedRequest('/api/compliance/safeguarding/officers');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Communications Endpoints', () => {
    it('should return communications array', async () => {
      const response = await authenticatedRequest('/api/communications');

      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
