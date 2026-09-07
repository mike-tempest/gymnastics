import { Discipline, ProgrammeFlag, SquadType } from '../enums/disciplines';

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
  /** Recreational badge class or competitive squad. */
  squad_type?: SquadType | null;
  /** Free-form recreational level label, e.g. "Rise Explore" or a club's own. */
  level?: string | null;
  discipline?: Discipline | null;
  programme_flags?: ProgrammeFlag[] | null;
  created_at: string;
  updated_at: string;
  members?: Member[];
  member_count?: number;
}
