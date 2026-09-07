import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_COUNTS, loginAs, authGet } from './helpers';

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
      expect(data.length).toBeGreaterThanOrEqual(DEMO_COUNTS.users);
    });
  });

  describe('Members', () => {
    it('GET /members returns array of members', async () => {
      const res = await authGet('/members', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(DEMO_COUNTS.members);
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
    it('GET /squads returns every squad', async () => {
      const res = await authGet('/squads', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(DEMO_COUNTS.squads);
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
      expect(data.length).toBeGreaterThanOrEqual(DEMO_COUNTS.sessions);
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
    it('GET /families returns every family', async () => {
      const res = await authGet('/families', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(DEMO_COUNTS.families);
    });
  });
});
