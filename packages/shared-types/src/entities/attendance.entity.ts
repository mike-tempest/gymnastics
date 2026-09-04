export interface Attendance {
  attendance_id: string;
  session_id: string;
  swimmer_id: string;
  status: AttendanceStatus;
  check_in_time?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  swimmer?: {
    swimmer_id: string;
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

export interface AttendanceStats {
  swimmer_id: string;
  total_sessions: number;
  attended: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number; // percentage
}
