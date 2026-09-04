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

  describe('Swimmers', () => {
    it('GET /swimmers returns array of swimmers', async () => {
      const res = await authGet('/swimmers', token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(30);
    });

    it('swimmers have required fields', async () => {
      const res = await authGet('/swimmers', token);
      const data = await res.json();
      const swimmer = data[0];
      expect(swimmer).toHaveProperty('swimmer_id');
      expect(swimmer).toHaveProperty('first_name');
      expect(swimmer).toHaveProperty('last_name');
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
