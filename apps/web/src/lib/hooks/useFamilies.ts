'use client';

import { Family } from '@club-manager/shared-types';

import { getFamilies, getFamily, getFamilyStatistics } from '@/lib/api/families';

import { useApi, UseApiResult } from './useApi';

export function useFamilies(): UseApiResult<Family[]> {
  return useApi(() => getFamilies(), []);
}

export function useFamily(id: string | undefined): UseApiResult<Family> {
  return useApi(() => getFamily(id!), [id], { enabled: !!id });
}

export function useFamilyStats(): UseApiResult<unknown> {
  return useApi(() => getFamilyStatistics(), []);
}
