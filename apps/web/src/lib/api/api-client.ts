/**
 * Typed API client with auth interceptor for Swimly
 * Handles authentication, error responses, and provides typed HTTP helpers
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Derive the liveness-probe URL from the API base. The membership service
 * exposes /health/live at the origin root (outside the /api prefix), so we
 * strip any path and use the origin.
 */
export function getLivenessUrl(): string | null {
  try {
    return `${new URL(API_BASE_URL).origin}/health/live`;
  } catch {
    // API_BASE_URL is relative or malformed; cannot determine a liveness URL.
    return null;
  }
}

/**
 * Actively probe whether the API server is reachable.
 *
 * Resolves true when the server answers with ANY HTTP status - reaching it at
 * all proves the network path is fine, even if a downstream dependency is
 * degraded. Resolves false only on a genuine network error or timeout.
 *
 * Deliberately does NOT consult navigator.onLine, which reports false on many
 * working networks (captive portals, proxies, some VPNs) and is the usual
 * cause of spurious "unable to connect" banners.
 */
export async function probeApiReachable(timeoutMs = 5000): Promise<boolean> {
  const url = getLivenessUrl();
  if (!url) return true; // cannot determine, assume reachable

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Custom error class for API responses
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Store the backend JWT in localStorage after login or registration
 */
export function storeBackendToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', token);
  }
}

/**
 * Remove the backend JWT from localStorage (e.g. on logout)
 */
export function clearBackendToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
  }
}

/**
 * Get auth token from localStorage (backend JWT stored after login)
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  return localStorage.getItem('access_token');
}

/**
 * Handle 401 responses by redirecting to login
 */
function handle401(): void {
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

/**
 * Base fetch wrapper with auth and error handling
 */
export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    handle401();
    throw new ApiError('Unauthorised', 401);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.message || `Request failed: ${response.statusText}`,
      response.status,
      body
    );
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return response.json();
}

/**
 * Fetches a binary resource with the normal auth headers and triggers a
 * browser download (same anchor mechanics as downloadCsv in lib/csv-export).
 * The filename comes from the Content-Disposition header when present,
 * falling back to the supplied default.
 */
export async function apiDownload(path: string, fallbackFilename: string): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (response.status === 401) {
    handle401();
    throw new ApiError('Unauthorised', 401);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.message || `Request failed: ${response.statusText}`,
      response.status,
      body
    );
  }

  const disposition = response.headers.get('content-disposition');
  const filename = disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallbackFilename;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * HTTP method helpers with TypeScript generics
 */
export const api = {
  get: <T>(path: string, options?: RequestInit): Promise<T> =>
    apiClient<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, data?: unknown, options?: RequestInit): Promise<T> =>
    apiClient<T>(path, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(path: string, data?: unknown, options?: RequestInit): Promise<T> =>
    apiClient<T>(path, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(path: string, data?: unknown, options?: RequestInit): Promise<T> =>
    apiClient<T>(path, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(path: string, options?: RequestInit): Promise<T> =>
    apiClient<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Legacy export for backward compatibility
 * @deprecated Use `api` object or `apiClient` instead
 */
export const fetchApi = apiClient;
