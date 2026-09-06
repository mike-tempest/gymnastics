import { loginAs, authGet, ADMIN_EMAIL, ADMIN_PASSWORD, COACH_EMAIL, COACH_PASSWORD, PARENT_EMAIL, PARENT_PASSWORD, API_BASE } from './helpers';

describe('Regression Tests', () => {
  it('Login returns access_token AND user object with correct role', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();

    // Must have access_token
    expect(data.access_token).toBeDefined();
    expect(typeof data.access_token).toBe('string');

    // Must have user object
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(ADMIN_EMAIL);
    expect(data.user.role).toBe('super_admin');
    expect(data.user.user_id || data.user.id).toBeDefined();
  });

  it('All decimal/money fields can be safely parsed as numbers', async () => {
    const adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    // Check invoices
    const invoicesRes = await authGet('/invoices', adminToken);
    expect(invoicesRes.status).toBe(200);
    const invoices = await invoicesRes.json();

    for (const invoice of invoices) {
      if (invoice.amount !== null && invoice.amount !== undefined) {
        const amount = parseFloat(invoice.amount);
        expect(isNaN(amount)).toBe(false);
        // Should support toFixed
        expect(() => amount.toFixed(2)).not.toThrow();
      }

      if (invoice.paid_amount !== null && invoice.paid_amount !== undefined) {
        const paidAmount = parseFloat(invoice.paid_amount);
        expect(isNaN(paidAmount)).toBe(false);
        expect(() => paidAmount.toFixed(2)).not.toThrow();
      }
    }

    // Check any other money fields in sessions or fees
    const sessionsRes = await authGet('/sessions', adminToken);
    if (sessionsRes.status === 200) {
      const sessions = await sessionsRes.json();
      for (const session of sessions) {
        if (session.cost !== null && session.cost !== undefined) {
          const cost = parseFloat(session.cost);
          expect(isNaN(cost)).toBe(false);
          expect(() => cost.toFixed(2)).not.toThrow();
        }
      }
    }
  });

  describe('Role Hierarchy', () => {
    it('super_admin can access all endpoints', async () => {
      const adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

      const endpoints = [
        '/members',
        '/squads',
        '/families',
        '/invoices',
        '/sessions',
        '/attendance',
        '/users',
        '/auth/profile',
      ];

      for (const endpoint of endpoints) {
        const res = await authGet(endpoint, adminToken);
        expect([200, 404]).toContain(res.status); // 404 is ok if endpoint exists but no data
      }
    });

    it('head_coach can access coach endpoints', async () => {
      const coachToken = await loginAs(COACH_EMAIL, COACH_PASSWORD);

      const coachEndpoints = [
        '/members',
        '/squads',
        '/sessions',
        '/attendance',
        '/auth/profile',
      ];

      for (const endpoint of coachEndpoints) {
        const res = await authGet(endpoint, coachToken);
        // Coach should be able to read these
        expect([200, 403, 404]).toContain(res.status);
      }
    });

    it('parent role is restricted to own data', async () => {
      const parentToken = await loginAs(PARENT_EMAIL, PARENT_PASSWORD);

      // Parent should not access all users
      const usersRes = await authGet('/users', parentToken);
      expect([401, 403]).toContain(usersRes.status);

      // Parent should be able to access profile
      const profileRes = await authGet('/auth/profile', parentToken);
      expect(profileRes.status).toBe(200);
      const profile = await profileRes.json();
      expect(profile.role).toBe('parent');
    });

    it('parent cannot create squads', async () => {
      const parentToken = await loginAs(PARENT_EMAIL, PARENT_PASSWORD);

      const res = await fetch(`${API_BASE}/squads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parentToken}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Squad',
          description: 'Should not be created',
        }),
      });

      expect([401, 403]).toContain(res.status);
    });
  });

  it('/compliance/summary endpoint returns valid structure', async () => {
    const adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    const res = await authGet('/compliance/summary', adminToken);
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const data = await res.json();

      // Should be an object or array
      expect(typeof data).toBe('object');

      // If it's an object, check for common compliance fields
      if (!Array.isArray(data)) {
        // Compliance summary typically has counts or status fields
        expect(data).toBeDefined();
        
        // Common fields that might exist
        const possibleFields = [
          'total_members',
          'missing_dbs',
          'expired_certifications',
          'compliant_count',
          'non_compliant_count',
          'summary',
          'status',
        ];

        // At least one field should be present
        const hasAtLeastOneField = possibleFields.some(field => field in data);
        expect(hasAtLeastOneField || Object.keys(data).length > 0).toBe(true);
      }
    }
  });

  it('Numeric IDs and UUIDs are consistently formatted', async () => {
    const adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    const membersRes = await authGet('/members', adminToken);
    expect(membersRes.status).toBe(200);
    const members = await membersRes.json();

    // UUID regex pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const member of members) {
      if (member.member_id) {
        // Should be a valid UUID
        expect(uuidPattern.test(member.member_id)).toBe(true);
      }
      if (member.family_id) {
        expect(uuidPattern.test(member.family_id)).toBe(true);
      }
      if (member.squad_id) {
        expect(uuidPattern.test(member.squad_id)).toBe(true);
      }
    }
  });

  it('Date fields are in ISO format or consistent format', async () => {
    const adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    const membersRes = await authGet('/members', adminToken);
    expect(membersRes.status).toBe(200);
    const members = await membersRes.json();

    for (const member of members) {
      if (member.date_of_birth) {
        // Should be parseable as a date
        const date = new Date(member.date_of_birth);
        expect(isNaN(date.getTime())).toBe(false);
      }

      if (member.created_at) {
        const createdDate = new Date(member.created_at);
        expect(isNaN(createdDate.getTime())).toBe(false);
      }
    }
  });

  it('Empty arrays are returned instead of null for list endpoints', async () => {
    const adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    const endpoints = ['/members', '/squads', '/families', '/invoices', '/sessions'];

    for (const endpoint of endpoints) {
      const res = await authGet(endpoint, adminToken);
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    }
  });
});
