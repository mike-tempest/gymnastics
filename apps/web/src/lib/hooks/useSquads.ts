'use client';

import { Squad, Member } from '@club-manager/shared-types';

import { getSquads, getSquad, getSquadMembers } from '@/lib/api/squads';

import { useApi, UseApiResult } from './useApi';

export function useSquads(): UseApiResult<Squad[]> {
  return useApi(() => getSquads(), []);
}

export function useSquad(id: string | undefined): UseApiResult<Squad> {
  return useApi(() => getSquad(id!), [id], { enabled: !!id });
}

export function useSquadMembers(squadId: string | undefined): UseApiResult<Member[]> {
  return useApi(() => getSquadMembers(squadId!), [squadId], { enabled: !!squadId });
}
