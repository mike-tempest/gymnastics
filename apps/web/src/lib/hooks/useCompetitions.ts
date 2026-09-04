'use client';

import { Competition } from '@swim-nexus/shared-types';

import { getCompetitions, getCompetition } from '@/lib/api/competitions';

import { useApi, UseApiResult } from './useApi';

export function useCompetitions(): UseApiResult<Competition[]> {
  return useApi(() => getCompetitions(), []);
}

export function useCompetition(id: string | undefined): UseApiResult<Competition> {
  return useApi(() => getCompetition(id!), [id], { enabled: !!id });
}
