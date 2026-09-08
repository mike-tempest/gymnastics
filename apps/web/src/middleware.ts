import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Role constants matching backend UserRole enum values (supports both cases)
const ADMIN_ROLES = ['ADMIN', 'admin', 'super_admin', 'SUPER_ADMIN'];
const COACH_ROLES = ['COACH', 'coach', 'head_coach', 'HEAD_COACH', 'squad_coach', 'SQUAD_COACH'];
const WELFARE_ROLES = ['welfare_officer', 'WELFARE_OFFICER'];
const PARENT_ROLE = 'PARENT';

// Routes accessible by coaches (in addition to admins)
const COACH_ROUTES = [
  '/attendance',
  '/sessions',
  '/members',
  '/squads',
  '/communications',
];

// Routes accessible by the club's Welfare Officer. The compliance screens are
// their job; the gymnast list is the context for it. Both are backed by
// endpoints the role can already read.
const WELFARE_ROUTES = ['/compliance', '/members'];

// The Welfare Officer's landing page. The club dashboard is built on finance
// figures they have no access to, so send them to compliance instead.
const WELFARE_HOME = '/compliance';

// Routes restricted to parents only
const PARENT_ROUTES = ['/parent'];

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

function isCoachRole(role: string): boolean {
  return COACH_ROLES.includes(role);
}

function isWelfareRole(role: string): boolean {
  return WELFARE_ROLES.includes(role);
}

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  // Not authenticated: redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string | undefined | null;
  const pathname = request.nextUrl.pathname;

  // Missing or invalid role: redirect to login to prevent loops
  if (!role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'invalid_session');
    return NextResponse.redirect(loginUrl);
  }

  // Admins have full access, but redirect away from parent routes
  if (isAdminRole(role)) {
    if (matchesRoute(pathname, PARENT_ROUTES)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Coach access
  if (isCoachRole(role)) {
    // Redirect coaches away from parent routes
    if (matchesRoute(pathname, PARENT_ROUTES)) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Coaches can access the dashboard
    if (pathname === '/') {
      return NextResponse.next();
    }

    if (matchesRoute(pathname, COACH_ROUTES)) {
      return NextResponse.next();
    }

    // Unauthorised: redirect coaches to dashboard
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Welfare Officer access: the compliance module and the gymnast list.
  // Anything else, including the club dashboard, lands on compliance rather
  // than bouncing them back to the login screen.
  if (isWelfareRole(role)) {
    if (matchesRoute(pathname, WELFARE_ROUTES)) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL(WELFARE_HOME, request.url));
  }

  // Parent access
  if (role === PARENT_ROLE || role === 'parent') {
    if (matchesRoute(pathname, PARENT_ROUTES)) {
      return NextResponse.next();
    }

    // Unauthorised: redirect parents to parent dashboard
    return NextResponse.redirect(new URL('/parent', request.url));
  }

  // Unknown role: redirect to login to prevent loops
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'invalid_session');
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/',
    '/members/:path*',
    '/families/:path*',
    '/squads/:path*',
    // The club's own waiting list. The public join and offer pages
    // (/join, /offer) are deliberately left out: a family answers an offer
    // without an account.
    '/waiting-list/:path*',
    '/invoices/:path*',
    '/dashboard/:path*',
    '/attendance/:path*',
    '/sessions/:path*',
    '/billing/:path*',
    '/admin/:path*',
    '/compliance/:path*',
    '/communications/:path*',
    '/fee-structures/:path*',
    '/payments/:path*',
    '/mandates/:path*',
    '/parent/:path*',
    '/onboarding/:path*',
  ],
};
