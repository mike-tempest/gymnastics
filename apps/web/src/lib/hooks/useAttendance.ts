'use client';

import { Attendance, AttendanceStats } from '@club-manager/shared-types';

import {
  getSessionAttendance,
  getMemberAttendance,
  getMemberAttendanceStats,
} from '@/lib/api/attendance';

import { useApi, UseApiResult } from './useApi';

export function useSessionAttendance(sessionId: string | undefined): UseApiResult<Attendance[]> {
  return useApi(() => getSessionAttendance(sessionId!), [sessionId], { enabled: !!sessionId });
}

export function useMemberAttendance(memberId: string | undefined): UseApiResult<Attendance[]> {
  return useApi(() => getMemberAttendance(memberId!), [memberId], { enabled: !!memberId });
}

export function useMemberAttendanceStats(memberId: string | undefined): UseApiResult<AttendanceStats> {
  return useApi(() => getMemberAttendanceStats(memberId!), [memberId], { enabled: !!memberId });
}
