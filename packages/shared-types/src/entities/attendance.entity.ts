export interface Attendance {
  attendance_id: string;
  session_id: string;
  member_id: string;
  status: AttendanceStatus;
  check_in_time?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  member?: {
    member_id: string;
    first_name: string;
    last_name: string;
    photo_url?: string | null;
  };
  session?: {
    session_id: string;
    session_name: string;
    session_date: string;
  };
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

/**
 * One line of a session register.
 *
 * A register lists everyone expected at the session, which is the session's
 * squad, and not only those who already have an attendance row. A gymnast
 * nobody has marked yet is returned with a null `attendance_id` and a null
 * `status`: the absence of a row is what "not yet marked" means, because
 * `AttendanceStatus` has no value for it and inventing one would make an
 * unmarked gymnast indistinguishable from a marked one in every count and
 * report. Marking a gymnast creates the row and fills both fields in.
 */
export interface SessionRosterEntry {
  attendance_id: string | null;
  session_id: string;
  member_id: string;
  status: AttendanceStatus | null;
  check_in_time?: string | null;
  notes?: string | null;
  created_at: string | null;
  updated_at: string | null;

  // Relations
  member?: {
    member_id: string;
    first_name: string;
    last_name: string;
    photo_url?: string | null;
  };
  session?: {
    session_id: string;
    session_name: string;
    session_date: string;
  };
}

export interface AttendanceStats {
  member_id: string;
  total_sessions: number;
  attended: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number; // percentage
}
