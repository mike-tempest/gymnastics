'use client';

import { Member } from '@club-manager/shared-types';

import {
  getMembers,
  getMember,
  getMemberStatistics,
  MemberStatistics,
} from '@/lib/api/members';

import { useApi, UseApiResult } from './useApi';

export function useMembers(): UseApiResult<Member[]> {
  return useApi(() => getMembers(), []);
}

export function useMember(id: string | undefined): UseApiResult<Member> {
  return useApi(() => getMember(id!), [id], { enabled: !!id });
}

export function useMemberStats(): UseApiResult<MemberStatistics> {
  return useApi(() => getMemberStatistics(), []);
}
