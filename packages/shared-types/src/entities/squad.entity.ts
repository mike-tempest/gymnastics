import { Member } from './member.entity';

export interface Squad {
  squad_id: string;
  squad_name: string;
  description?: string | null;
  min_age?: number | null;
  max_age?: number | null;
  coach_name?: string | null;
  training_times?: string | null;
  max_capacity?: number | null;
  created_at: string;
  updated_at: string;
  members?: Member[];
  member_count?: number;
}
