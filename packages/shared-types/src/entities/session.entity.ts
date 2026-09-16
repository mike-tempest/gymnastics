import { SessionStatus } from '../enums';

export interface Session {
  session_id: string;
  session_name: string;
  session_date: string; // ISO date string
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  squad_id: string | null;
  location: string | null;
  description: string | null;
  coach_name: string | null;
  max_participants: number | null;
  status: SessionStatus;
  series_id?: string | null;
  occurrence_date?: string | null;
  is_override?: boolean;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  squad?: {
    squad_id: string;
    squad_name: string;
  };
  attendance_count?: number;
  total_members?: number;
}
