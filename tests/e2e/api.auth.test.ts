import { API_BASE, ADMIN_EMAIL, ADMIN_PASSWORD, loginAs, authGet } from './helpers';

describe('Auth API', () => {
  it('POST /auth/login with valid credentials returns token and user', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.access_token).toBeDefined();
    expect(data.user.email).toBe(ADMIN_EMAIL);
    expect(data.user.role).toBe('super_admin');
  });

  it('POST /auth/login with invalid credentials returns 401', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: 'wrong' }),
    });

    expect([400, 401]).toContain(res.status);
  });

  it('POST /auth/login with missing fields returns 400 or 401', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    });

    expect([400, 401]).toContain(res.status);
  });

  it('GET /auth/profile with valid token returns user profile', async () => {
    const token = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await authGet('/auth/profile', token);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe(ADMIN_EMAIL);
    expect(data.role).toBe('super_admin');
    expect(data.user_id).toBeDefined();
  });

  it('GET /auth/profile without token returns 401', async () => {
    const res = await fetch(`${API_BASE}/auth/profile`);
    expect(res.status).toBe(401);
  });
});
