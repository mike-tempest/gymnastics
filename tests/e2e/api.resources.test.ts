import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAs, authGet } from './helpers';

describe('Resource APIs (authenticated as admin)', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  describe('Users', () => {
    it('GET /users returns array of users', async () => {
      const res = await authGet('/users', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Members', () => {
    it('GET /members returns array of members', async () => {
      const res = await authGet('/members', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(30);
    });

    it('members have required fields', async () => {
      const res = await authGet('/members', token);
      const data = await res.json();
      const member = data[0];
      expect(member).toHaveProperty('member_id');
      expect(member).toHaveProperty('first_name');
      expect(member).toHaveProperty('last_name');
    });
  });

  describe('Squads', () => {
    it('GET /squads returns 4 squads', async () => {
      const res = await authGet('/squads', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(4);
    });

    it('squads have required fields', async () => {
      const res = await authGet('/squads', token);
      const data = await res.json();
      const squad = data[0];
      expect(squad).toHaveProperty('squad_id');
      expect(squad).toHaveProperty('squad_name');
    });
  });

  describe('Sessions', () => {
    it('GET /sessions returns array of sessions', async () => {
      const res = await authGet('/sessions', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(78);
    });
  });

  describe('Attendance', () => {
    it('GET /attendance returns array', async () => {
      const res = await authGet('/attendance', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Families', () => {
    it('GET /families returns 10 families', async () => {
      const res = await authGet('/families', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(10);
    });
  });
});
