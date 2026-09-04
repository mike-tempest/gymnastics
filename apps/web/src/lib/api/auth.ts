import { api } from './api-client';

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface RegisterResponse {
  access_token: string;
  user: {
    user_id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
  };
}

export async function registerUser(data: RegisterData): Promise<RegisterResponse> {
  return api.post<RegisterResponse>('/auth/register', data);
}

// ==================== Self-Serve Club Signup ====================

export interface RegisterClubData {
  club: {
    name: string;
    // ISO 3166-1 alpha-2 country code (e.g. GB, US). Drives the club's
    // currency and region on the backend. Optional here so existing callers
    // stay valid; the backend accepts it once its companion PR is deployed.
    country?: string;
    // IANA timezone (e.g. America/New_York). Only sent for countries with
    // more than one timezone; the backend infers it from the country
    // otherwise. Ignored until the regional backend is deployed.
    timezone?: string;
    // Governing-body affiliation keys accepted by the signup DTO once the
    // affiliation-backend PR is deployed. Optional so existing callers stay
    // valid; sent alongside the legacy swim_england_region/affiliate_number.
    governing_body?: string;
    governing_body_region?: string;
    affiliation_number?: string;
    swim_england_region?: string;
    affiliate_number?: string;
    county?: string;
    contact_email?: string;
    phone?: string;
    website?: string;
  };
  admin: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  };
}

export interface RegisterClubResponse {
  access_token: string;
  user: {
    user_id: string;
    club_id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
  };
}

/**
 * Create a brand new club and its first admin in one atomic call, returning a
 * session token exactly like login. Public endpoint (no auth required).
 */
export async function registerClub(data: RegisterClubData): Promise<RegisterClubResponse> {
  return api.post<RegisterClubResponse>('/auth/register-club', data);
}

// ==================== Login & Profile ====================

export interface LoginData {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    user_id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
  };
}

export interface UserProfile {
  user_id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
}

export async function login(data: LoginData): Promise<LoginResponse> {
  return api.post<LoginResponse>('/auth/login', data);
}

export async function getProfile(): Promise<UserProfile> {
  return api.get<UserProfile>('/auth/profile', { cache: 'no-store' });
}
