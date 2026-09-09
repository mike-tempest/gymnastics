'use client';

import { Attendance, AttendanceStats, SessionRosterEntry } from '@club-manager/shared-types';

import {
  getSessionRoster,
  getMemberAttendance,
  getMemberAttendanceStats,
} from '@/lib/api/attendance';

import { useApi, UseApiResult } from './useApi';

export function useSessionRoster(
  sessionId: string | undefined
): UseApiResult<SessionRosterEntry[]> {
  return useApi(() => getSessionRoster(sessionId!), [sessionId], { enabled: !!sessionId });
}

export function useMemberAttendance(memberId: string | undefined): UseApiResult<Attendance[]> {
  return useApi(() => getMemberAttendance(memberId!), [memberId], { enabled: !!memberId });
}

export function useMemberAttendanceStats(
  memberId: string | undefined
): UseApiResult<AttendanceStats> {
  return useApi(() => getMemberAttendanceStats(memberId!), [memberId], { enabled: !!memberId });
}
