import { loginAs, authPost, ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE } from './helpers';

describe('API Validation', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  describe('Auth Registration Validation', () => {
    it('POST /auth/register with missing email returns 400', async () => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'ValidPassword123!',
          first_name: 'Test',
          last_name: 'User',
          role: 'parent',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('POST /auth/register with invalid email format returns 400', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com',
        'user..name@example.com',
      ];

      for (const email of invalidEmails) {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password: 'ValidPassword123!',
            first_name: 'Test',
            last_name: 'User',
            role: 'parent',
          }),
        });

        expect(res.status).toBe(400);
      }
    });

    it('POST /auth/register with short password returns 400', async () => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test_${Date.now()}@example.com`,
          password: '123',
          first_name: 'Test',
          last_name: 'User',
          role: 'parent',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('POST /auth/register with missing password returns 400', async () => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test_${Date.now()}@example.com`,
          first_name: 'Test',
          last_name: 'User',
          role: 'parent',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Swimmers Validation', () => {
    it('POST /api/swimmers with missing first_name returns 400', async () => {
      const res = await authPost('/swimmers', adminToken, {
        last_name: 'Test',
        dob: '2010-01-01',
        gender: 'M',
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/swimmers with missing last_name returns 400', async () => {
      const res = await authPost('/swimmers', adminToken, {
        first_name: 'Test',
        dob: '2010-01-01',
        gender: 'M',
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/swimmers with missing dob returns 400', async () => {
      const res = await authPost('/swimmers', adminToken, {
        first_name: 'Test',
        last_name: 'Swimmer',
        gender: 'M',
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/swimmers with invalid date format returns 400', async () => {
      const res = await authPost('/swimmers', adminToken, {
        first_name: 'Test',
        last_name: 'Swimmer',
        dob: 'not-a-date',
        gender: 'M',
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/swimmers with future dob returns 400', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const res = await authPost('/swimmers', adminToken, {
        first_name: 'Test',
        last_name: 'Swimmer',
        dob: futureDate.toISOString().split('T')[0],
        gender: 'M',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Invoices Validation', () => {
    it('POST /api/invoices with invalid family_id returns 400 or 404', async () => {
      const res = await authPost('/invoices', adminToken, {
        family_id: '00000000-0000-0000-0000-000000000000',
        amount: 50.00,
        due_date: '2026-03-01',
      });

      expect([400, 404]).toContain(res.status);
    });

    it('POST /api/invoices with non-UUID family_id returns 400', async () => {
      const res = await authPost('/invoices', adminToken, {
        family_id: 'not-a-uuid',
        amount: 50.00,
        due_date: '2026-03-01',
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/invoices with missing family_id returns 400', async () => {
      const res = await authPost('/invoices', adminToken, {
        amount: 50.00,
        due_date: '2026-03-01',
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/invoices with missing amount returns 400', async () => {
      const res = await authPost('/invoices', adminToken, {
        family_id: '00000000-0000-0000-0000-000000000000',
        due_date: '2026-03-01',
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/invoices with invalid amount format returns 400', async () => {
      const res = await authPost('/invoices', adminToken, {
        family_id: '00000000-0000-0000-0000-000000000000',
        amount: 'not-a-number',
        due_date: '2026-03-01',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Squads Validation', () => {
    it('POST /api/squads with missing squad_name returns 400', async () => {
      const res = await authPost('/squads', adminToken, {
        description: 'Test squad',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Login Validation', () => {
    it('POST /auth/login with missing email returns 400 or 401', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'password123',
        }),
      });

      expect([400, 401]).toContain(res.status);
    });

    it('POST /auth/login with missing password returns 400 or 401', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ADMIN_EMAIL,
        }),
      });

      expect([400, 401]).toContain(res.status);
    });
  });
});
