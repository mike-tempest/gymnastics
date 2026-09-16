import { api } from './api-client';

export interface SeriesDefinition {
  squad_id: string;
  session_name: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location?: string | null;
  coach_name?: string | null;
  description?: string | null;
  max_participants?: number | null;
  excluded_dates: string[];
}
export interface Timetable {
  term_id: string;
  name: string;
  start_date: string;
  end_date: string;
  timezone: string;
  series: { series_id: string; definition: SeriesDefinition }[];
}
export interface TimetableInput {
  name: string;
  start_date: string;
  end_date: string;
  source_term_id?: string;
  series: SeriesDefinition[];
  operation_id?: string;
  preview_token?: string;
}
export interface TimetablePreview {
  timezone: string;
  preview_token: string;
  can_commit: boolean;
  rows: {
    definition: SeriesDefinition;
    squad_name: string;
    dates: string[];
    scheduled: string[];
    occupied: number;
    capacity: number | null;
    places: number | null;
  }[];
}
export const getTimetables = () => api.get<Timetable[]>('/timetables');
export const previewTimetable = (data: TimetableInput) =>
  api.post<TimetablePreview>('/timetables/preview', data);
export const createTimetable = (data: TimetableInput) =>
  api.post<{ term_id: string; already_created?: boolean }>('/timetables', data);
export const editOccurrence = (
  id: string,
  data: { scope: 'one' | 'future'; definition: SeriesDefinition; session_date?: string }
) =>
  api.patch<{ updated: number; skipped: { session_id: string; date: string; reason: string }[] }>(
    `/timetables/occurrences/${id}`,
    data
  );
