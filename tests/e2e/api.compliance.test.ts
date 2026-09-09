import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAs, authGet } from './helpers';

describe('Compliance APIs (authenticated as admin)', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  describe('Summary', () => {
    it('GET /compliance/summary returns summary object', async () => {
      const res = await authGet('/compliance/summary', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('healthScore');
      expect(data).toHaveProperty('dbsValid');
      expect(data).toHaveProperty('consentComplete');
      expect(data).toHaveProperty('safeguardingOfficer');
      expect(typeof data.healthScore).toBe('number');
    });
  });

  describe('DBS Checks', () => {
    it('GET /compliance/dbs returns array', async () => {
      const res = await authGet('/compliance/dbs', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Consents', () => {
    it('GET /compliance/consents returns array', async () => {
      const res = await authGet('/compliance/consents', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Audit Logs', () => {
    it('GET /compliance/audit-logs returns array', async () => {
      const res = await authGet('/compliance/audit-logs', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Safeguarding', () => {
    it('GET /compliance/safeguarding/officers returns array', async () => {
      const res = await authGet('/compliance/safeguarding/officers', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /compliance/safeguarding/checklist returns array', async () => {
      const res = await authGet('/compliance/safeguarding/checklist', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Unauthorised access', () => {
    it('GET /compliance/dbs without token returns 401', async () => {
      const res = await fetch(
        `${process.env.API_BASE_URL || 'http://localhost:3001/api'}/compliance/dbs`
      );
      expect(res.status).toBe(401);
    });
  });
});
