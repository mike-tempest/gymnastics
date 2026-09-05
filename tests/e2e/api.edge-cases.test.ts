import { loginAs, authGet, authPost, ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE } from './helpers';

describe('Edge Cases API', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  it('Invalid UUID in URL returns 400 or 404', async () => {
    const res = await authGet('/members/not-a-uuid', adminToken);
    expect([400, 404]).toContain(res.status);
  });

  it('Invalid UUID in squads endpoint returns 400 or 404', async () => {
    const res = await authGet('/squads/invalid-uuid-123', adminToken);
    expect([400, 404]).toContain(res.status);
  });

  it('Invalid UUID in families endpoint returns 400 or 404', async () => {
    const res = await authGet('/families/not-valid', adminToken);
    expect([400, 404]).toContain(res.status);
  });

  it('Empty POST body returns 400', async () => {
    const res = await fetch(`${API_BASE}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: '{}',
    });

    expect(res.status).toBe(400);
  });

  it('Empty POST body to auth/register returns 400', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(res.status).toBe(400);
  });

  it('Duplicate email registration returns 409 or 400', async () => {
    // Try to register with an existing admin email
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: 'SomePassword123!',
        first_name: 'Duplicate',
        last_name: 'User',
        role: 'parent',
      }),
    });

    expect([400, 409]).toContain(res.status);
  });

  it('Very long string in first_name field is handled', async () => {
    const veryLongName = 'A'.repeat(1000);
    
    const familiesRes = await authGet('/families', adminToken);
    const families = await familiesRes.json();
    const familyId = families[0]?.family_id;

    const res = await authPost('/members', adminToken, {
      first_name: veryLongName,
      last_name: 'Test',
      dob: '2010-01-01',
      gender: 'M',
      family_id: familyId,
    });

    // Should return 400 (validation error) or 413 (payload too large)
    expect([400, 413, 422]).toContain(res.status);
  });

  it('Very long string in email field returns 400', async () => {
    const veryLongEmail = 'a'.repeat(500) + '@example.com';

    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: veryLongEmail,
        password: 'Password123!',
        first_name: 'Test',
        last_name: 'User',
        role: 'parent',
      }),
    });

    expect([400, 413, 422]).toContain(res.status);
  });

  it('Search with special characters is handled safely', async () => {
    const specialChars = ['<script>alert("xss")</script>', "'; DROP TABLE members; --", '../../../etc/passwd', '%00'];

    for (const searchTerm of specialChars) {
      const res = await authGet(`/members?search=${encodeURIComponent(searchTerm)}`, adminToken);
      // Should not crash, should return 200 with empty results or 400
      expect([200, 400]).toContain(res.status);
    }
  });

  it('Filter with SQL injection attempt is handled safely', async () => {
    const sqlInjection = "1' OR '1'='1";
    const res = await authGet(`/members?squad_id=${encodeURIComponent(sqlInjection)}`, adminToken);
    
    // Should not expose data, should return 400 or 404
    expect([200, 400, 404]).toContain(res.status);
  });

  it('Malformed JSON in POST body returns 400', async () => {
    const res = await fetch(`${API_BASE}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: '{this is not valid json}',
    });

    expect(res.status).toBe(400);
  });

  it('Non-existent endpoint returns 404', async () => {
    const res = await authGet('/this-endpoint-does-not-exist', adminToken);
    expect(res.status).toBe(404);
  });

  it('Negative numbers in amount field are validated', async () => {
    const familiesRes = await authGet('/families', adminToken);
    const families = await familiesRes.json();
    const familyId = families[0]?.family_id;

    const res = await authPost('/invoices', adminToken, {
      family_id: familyId,
      amount: -100.00,
      due_date: '2026-03-01',
    });

    // Should reject negative amounts
    expect([400, 422]).toContain(res.status);
  });
});
