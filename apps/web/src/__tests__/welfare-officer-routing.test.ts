/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Route-level access for the Welfare Officer. Before TEM-29 the role matched
// none of the middleware's role branches, so every guarded route fell through
// to the unknown-role case and bounced the officer back to the login screen.

const mockGetToken = jest.fn();
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

import { middleware } from '@/middleware';

function requestFor(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

async function locationFor(pathname: string): Promise<string | null> {
  const response = await middleware(requestFor(pathname));
  const location = response.headers.get('location');
  return location ? new URL(location).pathname : null;
}

describe('Welfare Officer route access', () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue({ role: 'welfare_officer' });
  });

  it.each([
    '/compliance',
    '/compliance/dbs',
    '/compliance/consent',
    '/compliance/safeguarding',
    '/members',
    '/members/some-id',
  ])('allows %s', async (pathname) => {
    expect(await locationFor(pathname)).toBeNull();
  });

  it('sends the club dashboard to compliance rather than back to login', async () => {
    expect(await locationFor('/')).toBe('/compliance');
  });

  it.each(['/billing', '/admin', '/payments', '/parent'])(
    'redirects %s to compliance',
    async (pathname) => {
      expect(await locationFor(pathname)).toBe('/compliance');
    }
  );

  it('leaves the other roles where they were', async () => {
    mockGetToken.mockResolvedValue({ role: 'super_admin' });
    expect(await locationFor('/billing')).toBeNull();

    mockGetToken.mockResolvedValue({ role: 'head_coach' });
    expect(await locationFor('/sessions')).toBeNull();
    expect(await locationFor('/billing')).toBe('/');

    mockGetToken.mockResolvedValue({ role: 'PARENT' });
    expect(await locationFor('/parent')).toBeNull();
    expect(await locationFor('/compliance')).toBe('/parent');
  });

  it('still sends a signed-out visitor to login', async () => {
    mockGetToken.mockResolvedValue(null);
    expect(await locationFor('/compliance')).toBe('/login');
  });
});
