import {
  ADMIN_EMAIL, ADMIN_PASSWORD,
  COACH_EMAIL, COACH_PASSWORD,
  PARENT_EMAIL, PARENT_PASSWORD,
  loginAs, authGet,
} from './helpers';

describe('Role-based access control', () => {
  let adminToken: string;
  let coachToken: string;
  let parentToken: string;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
    coachToken = await loginAs(COACH_EMAIL, COACH_PASSWORD);
    parentToken = await loginAs(PARENT_EMAIL, PARENT_PASSWORD);
  });

  describe('Admin (super_admin) access', () => {
    it('can access users', async () => {
      const res = await authGet('/users', adminToken);
      expect(res.status).toBe(200);
    });

    it('can access compliance', async () => {
      const res = await authGet('/compliance/dbs', adminToken);
      expect(res.status).toBe(200);
    });

    it('can access invoices', async () => {
      const res = await authGet('/invoices', adminToken);
      expect(res.status).toBe(200);
    });
  });

  describe('Coach (head_coach) access', () => {
    it('can access swimmers', async () => {
      const res = await authGet('/swimmers', coachToken);
      expect(res.status).toBe(200);
    });

    it('can access sessions', async () => {
      const res = await authGet('/sessions', coachToken);
      expect(res.status).toBe(200);
    });

    it('can access attendance', async () => {
      const res = await authGet('/attendance', coachToken);
      expect(res.status).toBe(200);
    });
  });

  describe('Parent access', () => {
    it('can access auth profile', async () => {
      const res = await authGet('/auth/profile', parentToken);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.role).toBe('parent');
    });
  });
});
