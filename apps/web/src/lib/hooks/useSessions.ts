'use client';

import { Session } from '@club-manager/shared-types';

import {
  getSessions,
  getSession,
  getUpcomingSessions,
  getSessionsBySquad,
} from '@/lib/api/sessions';

import { useApi, UseApiResult } from './useApi';

export function useSessions(): UseApiResult<Session[]> {
  return useApi(() => getSessions(), []);
}

export function useSessionDetail(id: string | undefined): UseApiResult<Session> {
  return useApi(() => getSession(id!), [id], { enabled: !!id });
}

export function useUpcomingSessions(): UseApiResult<Session[]> {
  return useApi(() => getUpcomingSessions(), []);
}

export function useSessionsBySquad(squadId: string | undefined): UseApiResult<Session[]> {
  return useApi(() => getSessionsBySquad(squadId!), [squadId], { enabled: !!squadId });
}
