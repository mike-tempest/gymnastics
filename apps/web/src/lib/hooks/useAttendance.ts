'use client';

import { Attendance, AttendanceStats } from '@swim-nexus/shared-types';

import {
  getSessionAttendance,
  getSwimmerAttendance,
  getSwimmerAttendanceStats,
} from '@/lib/api/attendance';

import { useApi, UseApiResult } from './useApi';

export function useSessionAttendance(sessionId: string | undefined): UseApiResult<Attendance[]> {
  return useApi(() => getSessionAttendance(sessionId!), [sessionId], { enabled: !!sessionId });
}

export function useSwimmerAttendance(swimmerId: string | undefined): UseApiResult<Attendance[]> {
  return useApi(() => getSwimmerAttendance(swimmerId!), [swimmerId], { enabled: !!swimmerId });
}

export function useSwimmerAttendanceStats(swimmerId: string | undefined): UseApiResult<AttendanceStats> {
  return useApi(() => getSwimmerAttendanceStats(swimmerId!), [swimmerId], { enabled: !!swimmerId });
}
