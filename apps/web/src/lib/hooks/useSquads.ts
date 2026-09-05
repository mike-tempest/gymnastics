'use client';

import { Squad, Swimmer } from '@club-manager/shared-types';

import { getSquads, getSquad, getSquadSwimmers } from '@/lib/api/squads';

import { useApi, UseApiResult } from './useApi';

export function useSquads(): UseApiResult<Squad[]> {
  return useApi(() => getSquads(), []);
}

export function useSquad(id: string | undefined): UseApiResult<Squad> {
  return useApi(() => getSquad(id!), [id], { enabled: !!id });
}

export function useSquadSwimmers(squadId: string | undefined): UseApiResult<Swimmer[]> {
  return useApi(() => getSquadSwimmers(squadId!), [squadId], { enabled: !!squadId });
}
