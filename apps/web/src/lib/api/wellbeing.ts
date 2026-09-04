import { api } from './api-client';

// --- Types ---

export interface WellbeingLog {
  log_id: string;
  swimmer_id: string;
  log_date: string;
  energy_level: number;
  sleep_quality: number | null;
  comfort_in_water: number;
  notes: string | null;
  prefers_land_training: boolean;
  created_at: string;
  readiness: 'green' | 'amber' | 'red';
}

export interface CycleLog {
  log_id: string;
  swimmer_id: string;
  period_start: string;
  period_end: string | null;
  symptoms: string[] | null;
  notes: string | null;
  created_at: string;
}

export interface CreateWellbeingLogPayload {
  swimmer_id: string;
  log_date: string;
  energy_level: number;
  sleep_quality?: number;
  comfort_in_water: number;
  notes?: string;
  prefers_land_training?: boolean;
}

export interface CreateCycleLogPayload {
  swimmer_id: string;
  period_start: string;
  period_end?: string;
  symptoms?: string[];
  notes?: string;
}

export interface SwimmerReadiness {
  swimmer_id: string;
  first_name: string;
  last_name: string;
  readiness: 'green' | 'amber' | 'red';
  prefers_land_training: boolean;
}

export interface SessionReadinessSummary {
  total: number;
  green: number;
  amber: number;
  red: number;
  no_data: number;
  swimmers: SwimmerReadiness[];
}

// --- Parent-facing API ---

export async function submitWellbeingCheckIn(
  data: CreateWellbeingLogPayload,
): Promise<WellbeingLog> {
  return api.post<WellbeingLog>('/wellbeing/check-in', data);
}

export async function fetchWellbeingHistory(
  swimmerId: string,
  limit?: number,
): Promise<WellbeingLog[]> {
  const params = limit ? `?limit=${limit}` : '';
  return api.get<WellbeingLog[]>(
    `/wellbeing/swimmer/${swimmerId}/history${params}`,
    { cache: 'no-store' },
  );
}

export async function fetchTodayCheckIn(
  swimmerId: string,
): Promise<WellbeingLog | null> {
  return api.get<WellbeingLog | null>(
    `/wellbeing/swimmer/${swimmerId}/today`,
    { cache: 'no-store' },
  );
}

// --- Cycle tracking ---

export async function submitCycleLog(
  data: CreateCycleLogPayload,
): Promise<CycleLog> {
  return api.post<CycleLog>('/wellbeing/cycle', data);
}

export async function fetchCycleHistory(
  swimmerId: string,
  limit?: number,
): Promise<CycleLog[]> {
  const params = limit ? `?limit=${limit}` : '';
  return api.get<CycleLog[]>(
    `/wellbeing/cycle/${swimmerId}/history${params}`,
    { cache: 'no-store' },
  );
}

// --- Coach-facing readiness API ---

export async function fetchSessionReadiness(
  swimmerIds: string[],
  date: string,
): Promise<SessionReadinessSummary> {
  const ids = swimmerIds.join(',');
  return api.get<SessionReadinessSummary>(
    `/wellbeing/readiness?swimmer_ids=${encodeURIComponent(ids)}&date=${date}`,
    { cache: 'no-store' },
  );
}
