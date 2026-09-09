import { Session, SessionStatus } from '@club-manager/shared-types';

import { api } from './api-client';

export interface CreateSessionInput {
  session_name: string;
  session_date: string; // ISO date string
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  squad_id: string;
  location?: string | null;
  description?: string | null;
  coach_name?: string | null;
  max_participants?: number | null;
  status?: SessionStatus;
}

export interface UpdateSessionInput {
  session_name?: string;
  session_date?: string;
  start_time?: string;
  end_time?: string;
  squad_id?: string;
  location?: string | null;
  description?: string | null;
  coach_name?: string | null;
  max_participants?: number | null;
  status?: SessionStatus;
}

export async function getSessions(): Promise<Session[]> {
  return api.get<Session[]>('/sessions', { cache: 'no-store' });
}

export async function getSession(id: string): Promise<Session> {
  return api.get<Session>(`/sessions/${id}`, { cache: 'no-store' });
}

export async function getUpcomingSessions(): Promise<Session[]> {
  return api.get<Session[]>('/sessions/upcoming', { cache: 'no-store' });
}

export async function getRecentSessions(days = 7): Promise<Session[]> {
  return api.get<Session[]>(`/sessions/recent?days=${days}`, { cache: 'no-store' });
}

export async function getSessionsBySquad(squadId: string): Promise<Session[]> {
  return api.get<Session[]>(`/sessions/squad/${squadId}`, { cache: 'no-store' });
}

export async function createSession(data: CreateSessionInput): Promise<Session> {
  return api.post<Session>('/sessions', data);
}

export async function updateSession(id: string, data: UpdateSessionInput): Promise<Session> {
  return api.patch<Session>(`/sessions/${id}`, data);
}

export async function updateSessionStatus(id: string, status: SessionStatus): Promise<Session> {
  return api.patch<Session>(`/sessions/${id}/status`, { status });
}

export async function deleteSession(id: string): Promise<void> {
  return api.delete<void>(`/sessions/${id}`);
}

// ==================== Statistics ====================

export interface SessionStatistics {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  by_squad: Record<string, number>;
}

export async function getSessionStatistics(): Promise<SessionStatistics> {
  return api.get<SessionStatistics>('/sessions/statistics', { cache: 'no-store' });
}

// ==================== Date Range Query ====================

export async function getSessionsByDateRange(
  startDate: string,
  endDate: string
): Promise<Session[]> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  return api.get<Session[]>(`/sessions?${params.toString()}`, { cache: 'no-store' });
}
