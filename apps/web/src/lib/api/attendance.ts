import { Attendance, AttendanceStatus, AttendanceStats } from '@swim-nexus/shared-types';

import { api } from './api-client';

export interface MarkAttendanceInput {
  swimmer_ids: string[];
  status: AttendanceStatus;
}

export interface UpdateAttendanceInput {
  status?: AttendanceStatus;
  notes?: string | null;
}

export async function getSessionAttendance(sessionId: string): Promise<Attendance[]> {
  return api.get<Attendance[]>(`/attendance/session/${sessionId}`, { cache: 'no-store' });
}

export async function getSwimmerAttendance(swimmerId: string): Promise<Attendance[]> {
  return api.get<Attendance[]>(`/attendance/swimmer/${swimmerId}`, { cache: 'no-store' });
}

export async function getSwimmerAttendanceStats(swimmerId: string): Promise<AttendanceStats> {
  return api.get<AttendanceStats>(`/attendance/swimmer/${swimmerId}/stats`, {
    cache: 'no-store',
  });
}

export async function markAttendance(
  sessionId: string,
  swimmerIds: string[],
  status: AttendanceStatus,
): Promise<void> {
  return api.post<void>('/attendance/bulk', {
    session_id: sessionId,
    swimmer_ids: swimmerIds,
    status,
  });
}

export async function checkInSwimmer(sessionId: string, swimmerId: string): Promise<Attendance> {
  return api.post<Attendance>('/attendance/check-in', {
    session_id: sessionId,
    swimmer_id: swimmerId,
  });
}

export async function updateAttendance(id: string, data: UpdateAttendanceInput): Promise<Attendance> {
  return api.patch<Attendance>(`/attendance/${id}`, data);
}
