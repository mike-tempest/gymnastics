import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  PARENT_EMAIL,
  PARENT_PASSWORD,
  loginAs,
  authGet,
  authPost,
  authDelete,
} from './helpers';

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

describe('Welfare Officer staff attribution', () => {
  let welfare: string;
  let admin: string;
  const created: Array<{ path: string; id: string }> = [];
  beforeAll(async () => {
    welfare = await loginAs(
      process.env.TEST_WELFARE_EMAIL || 'gemma.laird@kestrelvalegym.org.uk',
      process.env.TEST_WELFARE_PASSWORD || 'Demo2024!'
    );
    admin = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  });
  afterAll(async () => {
    for (const item of created) await authDelete(`${item.path}/${item.id}`, admin);
  });
  it('returns only active staff identities, while general user access stays forbidden', async () => {
    const response = await authGet('/users/staff-directory', welfare);
    expect(response.status).toBe(200);
    const staff = await response.json();
    expect(staff.length).toBeGreaterThanOrEqual(5);
    for (const entry of staff) {
      expect(Object.keys(entry).sort()).toEqual(['first_name', 'last_name', 'role', 'user_id']);
      expect(entry.role).not.toBe('parent');
    }
    expect((await authGet('/users', welfare)).status).toBe(403);
    const parent = await loginAs(PARENT_EMAIL, PARENT_PASSWORD);
    expect((await authGet('/users/staff-directory', parent)).status).toBe(403);
  });
  it('records a DBS check and a credential for a selected coach', async () => {
    const staff = await (await authGet('/users/staff-directory', welfare)).json();
    const coach = staff.find((entry: { role: string }) => entry.role === 'head_coach');
    expect(coach).toBeDefined();
    const check = await authPost('/compliance/dbs', welfare, {
      user_id: coach.user_id,
      certificate_number: `TEM37-${Date.now()}`,
      check_type: 'ENHANCED_BARRED',
      issue_date: '2026-09-01',
    });
    expect(check.status).toBe(201);
    const checkBody = await check.json();
    created.push({ path: '/compliance/dbs', id: checkBody.dbs_check_id });
    expect(checkBody.user_id).toBe(coach.user_id);
    const credential = await authPost('/compliance/credentials', welfare, {
      user_id: coach.user_id,
      credential_type: 'first_aid',
      title: 'TEM-37 staff attribution test',
      issue_date: '2026-09-01',
    });
    expect(credential.status).toBe(201);
    const credentialBody = await credential.json();
    created.push({ path: '/compliance/credentials', id: credentialBody.credential_id });
    expect(credentialBody.user_id).toBe(coach.user_id);
  });
});
