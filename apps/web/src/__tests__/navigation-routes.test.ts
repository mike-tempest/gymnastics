/** @jest-environment node */
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { middleware } from '@/middleware';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
const token = getToken as jest.Mock;

describe('navigation route permissions', () => {
  it.each([
    ['head_coach', '/waiting-list'],
    ['HEAD_COACH', '/waiting-list/entry-1'],
    ['head_coach', '/awards'],
    ['squad_coach', '/awards'],
    ['treasurer', '/billing'],
    ['TREASURER', '/waiting-list'],
    ['welfare_officer', '/compliance'],
    ['parent', '/parent/children'],
  ])('allows the supported %s link to %s', async (role, path) => {
    token.mockResolvedValue({ role });
    const response = await middleware(new NextRequest(`http://localhost${path}`));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it.each([
    ['squad_coach', '/waiting-list', '/'],
    ['head_coach', '/billing', '/'],
    ['welfare_officer', '/awards', '/compliance'],
    ['parent', '/awards', '/parent'],
    ['parent', '/waiting-list', '/parent'],
  ])('still restricts %s from %s', async (role, path, destination) => {
    token.mockResolvedValue({ role });
    const response = await middleware(new NextRequest(`http://localhost${path}`));
    expect(response.headers.get('location')).toBe(`http://localhost${destination}`);
  });
});
