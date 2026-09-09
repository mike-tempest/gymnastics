/**
 * Auth utilities for client-side authentication
 * These work alongside the existing NextAuth setup
 */

export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'ADMIN' | 'COACH' | 'PARENT';
  active: boolean;
}

export interface AuthTokens {
  access_token: string;
  user: User;
}

/**
 * Get the stored access token
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * Get the stored user data
 */
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

/**
 * Store auth tokens
 */
export function setAuthTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('user', JSON.stringify(tokens.user));
}

/**
 * Clear auth tokens (logout)
 */
export function clearAuthTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Check if user has a specific role
 */
export function hasRole(role: 'ADMIN' | 'COACH' | 'PARENT'): boolean {
  const user = getUser();
  return user?.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(roles: ('ADMIN' | 'COACH' | 'PARENT')[]): boolean {
  const user = getUser();
  return user ? roles.includes(user.role) : false;
}

/**
 * Get auth headers for API requests
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<AuthTokens> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }

  const data = await response.json();
  setAuthTokens(data);
  return data;
}

/**
 * Register a new user
 */
export async function register(userData: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: 'ADMIN' | 'COACH' | 'PARENT';
}): Promise<AuthTokens> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }

  const data = await response.json();
  setAuthTokens(data);
  return data;
}

/**
 * Logout the current user
 */
export function logout(): void {
  clearAuthTokens();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
