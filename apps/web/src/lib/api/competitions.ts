import {
  Competition,
  CompetitionType,
  CompetitionStatus,
  Course,
  QualifyingTime,
  RelayLeg,
  MemberPersonalBests,
} from '@club-manager/shared-types';

import { api } from './api-client';

export type { QualifyingTime, RelayLeg, MemberPersonalBests };
export type { PersonalBest, SeasonBest } from '@club-manager/shared-types';

export interface CreateCompetitionInput {
  name: string;
  organiser?: string;
  venue?: string;
  start_date: string;
  end_date?: string;
  type?: CompetitionType;
  course?: Course;
  status?: CompetitionStatus;
  entry_deadline?: string;
  qualifying_times?: QualifyingTime[];
}

export interface UpdateCompetitionInput {
  name?: string;
  organiser?: string;
  venue?: string;
  start_date?: string;
  end_date?: string;
  type?: CompetitionType;
  course?: Course;
  status?: CompetitionStatus;
  entry_deadline?: string;
  qualifying_times?: QualifyingTime[];
}

export async function getCompetitions(): Promise<Competition[]> {
  return api.get<Competition[]>('/competitions', { cache: 'no-store' });
}

export async function getCompetition(id: string): Promise<Competition> {
  return api.get<Competition>(`/competitions/${id}`, { cache: 'no-store' });
}

export async function createCompetition(data: CreateCompetitionInput): Promise<Competition> {
  return api.post<Competition>('/competitions', data);
}

export async function updateCompetition(id: string, data: UpdateCompetitionInput): Promise<Competition> {
  return api.patch<Competition>(`/competitions/${id}`, data);
}

export async function deleteCompetition(id: string): Promise<void> {
  return api.delete<void>(`/competitions/${id}`);
}

// --- Entry Management ---

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
  status: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'WITHDRAWN';
  created_at: string;
  member?: {
    member_id: string;
    first_name: string;
    last_name: string;
  };
}

export interface CreateEntryInput {
  member_id: string;
  event_name?: string;
  distance: number;
  stroke: string;
  entry_time?: number;
  seed_time?: number;
  age_group?: string;
}

export async function getCompetitionEntries(competitionId: string): Promise<CompetitionEntry[]> {
  return api.get<CompetitionEntry[]>(`/competitions/${competitionId}/entries`, { cache: 'no-store' });
}

export async function addCompetitionEntries(
  competitionId: string,
  entries: CreateEntryInput[],
): Promise<CompetitionEntry[]> {
  return api.post<CompetitionEntry[]>(`/competitions/${competitionId}/entries`, entries);
}

// --- Results ---

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
  member?: {
    first_name: string;
    last_name: string;
  };
  competition?: {
    competition_id: string;
    name: string;
    start_date: string;
    course: Course;
  };
}

export interface CreateResultInput {
  member_id: string;
  event_name?: string;
  distance: number;
  stroke: string;
  time: number;
  place?: number;
  heat?: number;
  lane?: number;
  dq?: boolean;
  dq_reason?: string;
  splits?: number[];
  course?: Course;
  is_relay?: boolean;
  relay_legs?: RelayLeg[];
}

export type UpdateResultInput = Partial<Omit<CreateResultInput, 'member_id'>>;

export async function addCompetitionResult(
  competitionId: string,
  data: CreateResultInput,
): Promise<CompetitionResult> {
  return api.post<CompetitionResult>(`/competitions/${competitionId}/results`, data);
}

export async function updateCompetitionResult(
  competitionId: string,
  resultId: string,
  data: UpdateResultInput,
): Promise<CompetitionResult> {
  return api.patch<CompetitionResult>(`/competitions/${competitionId}/results/${resultId}`, data);
}

export async function deleteCompetitionResult(
  competitionId: string,
  resultId: string,
): Promise<void> {
  return api.delete<void>(`/competitions/${competitionId}/results/${resultId}`);
}

export interface ImportPreview {
  format: string;
  meetName: string;
  totalResults: number;
  matchedMembers: number;
  unmatchedMembers: string[];
  validation: Record<string, unknown>;
  results: ParsedResult[];
}

export interface ParsedResult {
  event_name: string;
  distance: number;
  stroke: string;
  time: number;
  member_name: string;
  place: number | null;
  heat: number | null;
  lane: number | null;
  dq: boolean;
  dq_reason: string | null;
  is_pb: boolean;
  splits: number[] | null;
}

export interface ImportOutcome {
  imported: number;
  newPBs: number;
  errors: string[];
  warnings: string[];
}

export async function getCompetitionResults(competitionId: string): Promise<CompetitionResult[]> {
  return api.get<CompetitionResult[]>(`/competitions/${competitionId}/results`, { cache: 'no-store' });
}

export async function importCompetitionResults(
  competitionId: string,
  file: File,
  format?: string,
  preview?: boolean,
): Promise<ImportPreview | ImportOutcome> {
  const { API_BASE_URL } = await import('./api-client');
  const formData = new FormData();
  formData.append('file', file);

  const params = new URLSearchParams();
  if (format) params.set('format', format);
  if (preview) params.set('preview', 'true');

  const queryString = params.toString();
  const url = `${API_BASE_URL}/competitions/${competitionId}/import${queryString ? `?${queryString}` : ''}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const response = await fetch(url, {
    method: 'POST',
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Import failed: ${response.statusText}`);
  }

  return response.json();
}

// --- CSV Times Import (baseline PBs) ---

export interface TimesRowError {
  row: number;
  message: string;
}

export interface ParsedTimeRow {
  row: number;
  member_id: string;
  memberName: string;
  distance: number;
  stroke: string;
  time: number;
  course: string;
  swum_at: string | null;
}

export interface TimesImportPreview {
  totalRows: number;
  validRows: ParsedTimeRow[];
  errors: TimesRowError[];
}

export interface TimesImportOutcome {
  imported: number;
  newPBs: number;
  errors: TimesRowError[];
  warnings: string[];
}

export async function importCompetitionTimes(
  competitionId: string,
  file: File,
  preview?: boolean,
): Promise<TimesImportPreview | TimesImportOutcome> {
  const { API_BASE_URL } = await import('./api-client');
  const formData = new FormData();
  formData.append('file', file);

  const url = `${API_BASE_URL}/competitions/${competitionId}/import-times${preview ? '?preview=true' : ''}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const response = await fetch(url, {
    method: 'POST',
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Import failed: ${response.statusText}`);
  }

  return response.json();
}

export async function exportCompetitionEntries(
  competitionId: string,
  format: string,
): Promise<void> {
  const { API_BASE_URL } = await import('./api-client');
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const response = await fetch(
    `${API_BASE_URL}/competitions/${competitionId}/export?format=${encodeURIComponent(format)}`,
    {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Export failed: ${response.statusText}`);
  }

  const disposition = response.headers.get('Content-Disposition');
  let filename = `entries.${format === 'hy3' ? 'hy3' : 'csv'}`;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

// --- Member Results ---

export async function getMemberResults(memberId: string): Promise<CompetitionResult[]> {
  return api.get<CompetitionResult[]>(`/competitions/member/${memberId}/results`, { cache: 'no-store' });
}

export async function getMemberPersonalBests(memberId: string): Promise<MemberPersonalBests> {
  return api.get<MemberPersonalBests>(`/competitions/member/${memberId}/personal-bests`, { cache: 'no-store' });
}
