import { Attendance, AttendanceStatus, AttendanceStats } from '@club-manager/shared-types';

import { api } from './api-client';

export interface MarkAttendanceInput {
  member_ids: string[];
  status: AttendanceStatus;
}

export interface UpdateAttendanceInput {
  status?: AttendanceStatus;
  notes?: string | null;
}

export async function getSessionAttendance(sessionId: string): Promise<Attendance[]> {
  return api.get<Attendance[]>(`/attendance/session/${sessionId}`, { cache: 'no-store' });
}

export async function getMemberAttendance(memberId: string): Promise<Attendance[]> {
  return api.get<Attendance[]>(`/attendance/member/${memberId}`, { cache: 'no-store' });
}

export async function getMemberAttendanceStats(memberId: string): Promise<AttendanceStats> {
  return api.get<AttendanceStats>(`/attendance/member/${memberId}/stats`, {
    cache: 'no-store',
  });
}

export async function markAttendance(
  sessionId: string,
  memberIds: string[],
  status: AttendanceStatus,
): Promise<void> {
  return api.post<void>('/attendance/bulk', {
    session_id: sessionId,
    member_ids: memberIds,
    status,
  });
}

export async function checkInMember(sessionId: string, memberId: string): Promise<Attendance> {
  return api.post<Attendance>('/attendance/check-in', {
    session_id: sessionId,
    member_id: memberId,
  });
}

export async function updateAttendance(id: string, data: UpdateAttendanceInput): Promise<Attendance> {
  return api.patch<Attendance>(`/attendance/${id}`, data);
}
