import { Discipline, Member } from '@club-manager/shared-types';

import { api } from './api-client';

export interface CreateMemberInput {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  registration_number?: string | null;
  governing_body?: string | null;
  family_id?: string;
  club_id?: string;
  squad_id?: string;
  discipline?: Discipline | null;
  medical_notes?: string;
  emergency_contact?: string;
}

export interface UpdateMemberInput {
  first_name?: string;
  last_name?: string;
  dob?: string;
  gender?: string;
  registration_number?: string | null;
  governing_body?: string | null;
  squad_id?: string;
  discipline?: Discipline | null;
  medical_notes?: string;
  emergency_contact?: string;
}

/** Server-side narrowing for the members list. Filters compose. */
export interface MemberQuery {
  family_id?: string;
  squad_id?: string;
  discipline?: Discipline;
}

export async function createMember(data: CreateMemberInput): Promise<Member> {
  return api.post<Member>('/members', data);
}

export async function updateMember(id: string, data: UpdateMemberInput): Promise<Member> {
  return api.patch<Member>(`/members/${id}`, data);
}

export async function getMembers(query: MemberQuery = {}): Promise<Member[]> {
  const params = new URLSearchParams();
  if (query.family_id) params.set('family_id', query.family_id);
  if (query.squad_id) params.set('squad_id', query.squad_id);
  if (query.discipline) params.set('discipline', query.discipline);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return api.get<Member[]>(`/members${suffix}`, { cache: 'no-store' });
}

export async function getMember(id: string): Promise<Member> {
  return api.get<Member>(`/members/${id}`, { cache: 'no-store' });
}

export async function deleteMember(id: string): Promise<void> {
  return api.delete<void>(`/members/${id}`);
}

// ==================== Filtered Queries ====================

export async function getMembersByFamily(familyId: string): Promise<Member[]> {
  return getMembers({ family_id: familyId });
}

export async function getMembersBySquad(squadId: string): Promise<Member[]> {
  return getMembers({ squad_id: squadId });
}

export async function getMembersByDiscipline(discipline: Discipline): Promise<Member[]> {
  return getMembers({ discipline });
}

export async function getMembersByClub(clubId: string): Promise<Member[]> {
  return api.get<Member[]>(`/members?club_id=${encodeURIComponent(clubId)}`, { cache: 'no-store' });
}

// ==================== Statistics ====================

export interface MemberStatistics {
  total: number;
  by_squad: Record<string, number>;
  by_gender: Record<string, number>;
  age_range: { min: number; max: number; average: number };
}

export async function getMemberStatistics(): Promise<MemberStatistics> {
  return api.get<MemberStatistics>('/members/statistics', { cache: 'no-store' });
}
