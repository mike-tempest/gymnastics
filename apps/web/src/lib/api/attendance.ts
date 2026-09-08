import {
  Attendance,
  AttendanceStatus,
  AttendanceStats,
  SessionRosterEntry,
} from '@club-manager/shared-types';

import { api } from './api-client';

export interface MarkAttendanceInput {
  member_ids: string[];
  status: AttendanceStatus;
}

export interface UpdateAttendanceInput {
  status?: AttendanceStatus;
  notes?: string | null;
}

/**
 * The register for a session: everyone expected, marked or not. Entries with a
 * null status are gymnasts nobody has marked yet and have no attendance row
 * behind them, so they carry a null attendance_id.
 */
export async function getSessionRoster(sessionId: string): Promise<SessionRosterEntry[]> {
  return api.get<SessionRosterEntry[]>(`/attendance/session/${sessionId}`, { cache: 'no-store' });
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

/**
 * Records a status for a gymnast who has no attendance row yet, which is every
 * gymnast on a session nobody has taken the register for. Unlike check-in this
 * carries the status the coach chose and any note with it, so marking somebody
 * absent does not quietly record them present.
 */
export async function createAttendance(
  sessionId: string,
  memberId: string,
  status: AttendanceStatus,
  notes: string | null,
): Promise<Attendance> {
  return api.post<Attendance>('/attendance', {
    session_id: sessionId,
    member_id: memberId,
    status,
    ...(notes ? { notes } : {}),
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
