'use client';

import { Swimmer } from '@swim-nexus/shared-types';

import {
  getSwimmers,
  getSwimmer,
  getSwimmerStatistics,
  SwimmerStatistics,
} from '@/lib/api/swimmers';

import { useApi, UseApiResult } from './useApi';

export function useSwimmers(): UseApiResult<Swimmer[]> {
  return useApi(() => getSwimmers(), []);
}

export function useSwimmer(id: string | undefined): UseApiResult<Swimmer> {
  return useApi(() => getSwimmer(id!), [id], { enabled: !!id });
}

export function useSwimmerStats(): UseApiResult<SwimmerStatistics> {
  return useApi(() => getSwimmerStatistics(), []);
}
