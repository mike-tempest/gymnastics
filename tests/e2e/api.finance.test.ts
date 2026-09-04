import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAs, authGet } from './helpers';

describe('Finance APIs (authenticated as admin)', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  describe('Fee Structures', () => {
    it('GET /fee-structures returns array', async () => {
      const res = await authGet('/fee-structures', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(6);
    });
  });

  describe('Invoices', () => {
    it('GET /invoices returns array', async () => {
      const res = await authGet('/invoices', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(10);
    });

    it('invoices have required fields', async () => {
      const res = await authGet('/invoices', token);
      const data = await res.json();
      const invoice = data[0];
      expect(invoice).toHaveProperty('invoice_id');
      expect(invoice).toHaveProperty('total_amount');
      expect(invoice).toHaveProperty('status');
    });
  });

  describe('Payments', () => {
    it('GET /payments returns array', async () => {
      const res = await authGet('/payments', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Mandates', () => {
    it('GET /mandates returns array', async () => {
      const res = await authGet('/mandates', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
