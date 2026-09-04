import { Attendance, AttendanceStatus } from '../../modules/attendance/entities/attendance.entity';

export function buildAttendance(overrides?: Partial<Attendance>): Attendance {
  const now = new Date();

  const defaults: Attendance = {
    attendance_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    swimmer_id: crypto.randomUUID(),
    status: AttendanceStatus.PRESENT,
    checked_in_at: null,
    notes: null,
    created_at: now,
    updated_at: now,
  };

  return { ...defaults, ...overrides };
}
