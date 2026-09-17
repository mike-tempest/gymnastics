/** @jest-environment node */
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { middleware } from '../middleware';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('next/server', () => ({
  NextResponse: Object.assign(
    class {
      constructor(
        public body: string,
        public options: { status: number }
      ) {}
    },
    { redirect: (url: URL) => ({ redirect: url.toString() }), next: () => ({ next: true }) }
  ),
}));

const backend = jest.fn();
beforeEach(() => {
  global.fetch = backend;
  backend.mockReset();
  jest.mocked(getToken).mockResolvedValue({ role: 'parent', accessToken: 'old-session' });
});
const req = {
  url: 'https://tumblebase.example/parent',
  nextUrl: { pathname: '/parent' },
} as NextRequest;

it('blocks a still-present NextAuth cookie after its backend token is revoked', async () => {
  backend.mockResolvedValue({ ok: false, status: 401 });
  expect(await middleware(req)).toEqual({ redirect: 'https://tumblebase.example/login' });
  expect(backend).toHaveBeenCalledWith(
    expect.stringContaining('/auth/profile'),
    expect.objectContaining({ headers: { Authorization: 'Bearer old-session' }, cache: 'no-store' })
  );
});
it('allows an authenticated navigation when the backend token is current', async () => {
  backend.mockResolvedValue({ ok: true, status: 200 });
  expect(await middleware(req)).toEqual({ next: true });
});
it('fails closed without claiming sign-out when the API is unreachable', async () => {
  backend.mockRejectedValue(new Error('Unavailable'));
  expect(await middleware(req)).toMatchObject({ options: { status: 503 } });
});
it('rejects cookies without a backend token', async () => {
  jest.mocked(getToken).mockResolvedValue({ role: 'parent' });
  expect(await middleware(req)).toEqual({ redirect: 'https://tumblebase.example/login' });
  expect(backend).not.toHaveBeenCalled();
});
