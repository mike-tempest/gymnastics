import {
  Course,
  CompetitionType,
  CompetitionStatus,
  CompetitionEntryStatus,
} from '../enums';

export { CompetitionType, CompetitionStatus, CompetitionEntryStatus };

export interface QualifyingTime {
  distance: number;
  stroke: string;
  /** Slowest time (in seconds) that qualifies for the event. */
  time: number;
}

export interface RelayLeg {
  leg: number;
  member_id: string | null;
  name: string | null;
  split: number | null;
}

export interface Competition {
  competition_id: string;
  club_id: string | null;
  name: string;
  organiser: string | null;
  venue: string | null;
  start_date: string;
  end_date: string | null;
  type: CompetitionType;
  course: Course;
  status: CompetitionStatus;
  entry_deadline: string | null;
  qualifying_times: QualifyingTime[] | null;
  created_at: string;
  updated_at: string;
  entries?: CompetitionEntry[];
  results?: CompetitionResult[];
}

export interface CompetitionEntry {
  entry_id: string;
  competition_id: string;
  member_id: string;
  event_name: string | null;
  distance: number;
  stroke: string;
  entry_time: number | null;
  seed_time: number | null;
  age_group: string | null;
  status: CompetitionEntryStatus;
  created_at: string;
}

export interface CompetitionResult {
  result_id: string;
  competition_id: string;
  member_id: string;
  event_name: string | null;
  distance: number;
  stroke: string;
  time: number;
  place: number | null;
  heat: number | null;
  lane: number | null;
  dq: boolean;
  dq_reason: string | null;
  is_pb: boolean;
  splits: number[] | null;
  course: Course | null;
  swum_at: string | null;
  is_relay: boolean;
  relay_legs: RelayLeg[] | null;
  created_at: string;
  competition?: Competition;
}

export interface PersonalBest {
  pb_id: string;
  club_id: string | null;
  member_id: string;
  distance: number;
  stroke: string;
  course: Course;
  time: number;
  result_id: string | null;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeasonBest {
  distance: number;
  stroke: string;
  course: Course;
  time: number;
  result_id: string;
  achieved_at: string | null;
}

export interface MemberPersonalBests {
  personalBests: PersonalBest[];
  seasonBests: SeasonBest[];
  seasonStart: string;
}
