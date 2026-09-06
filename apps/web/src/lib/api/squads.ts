import { Squad, Member } from '@club-manager/shared-types';

import { api } from './api-client';

export interface CreateSquadInput {
  squad_name: string;
  description?: string;
  min_age?: number | null;
  max_age?: number | null;
  coach_name?: string;
  training_times?: string;
  max_capacity?: number | null;
}

export interface UpdateSquadInput {
  squad_name?: string;
  description?: string;
  min_age?: number | null;
  max_age?: number | null;
  coach_name?: string;
  training_times?: string;
  max_capacity?: number | null;
}

export async function createSquad(data: CreateSquadInput): Promise<Squad> {
  return api.post<Squad>('/squads', data);
}

export async function updateSquad(id: string, data: UpdateSquadInput): Promise<Squad> {
  return api.patch<Squad>(`/squads/${id}`, data);
}

export async function getSquads(): Promise<Squad[]> {
  return api.get<Squad[]>('/squads', { cache: 'no-store' });
}

export async function getSquad(id: string): Promise<Squad> {
  return api.get<Squad>(`/squads/${id}`, { cache: 'no-store' });
}

export async function deleteSquad(id: string): Promise<void> {
  return api.delete<void>(`/squads/${id}`);
}

export async function assignMemberToSquad(squadId: string, memberId: string): Promise<Squad> {
  return api.post<Squad>(`/squads/${squadId}/members`, { member_id: memberId });
}

export async function removeMemberFromSquad(squadId: string, memberId: string): Promise<Squad> {
  return api.delete<Squad>(`/squads/${squadId}/members/${memberId}`);
}

export async function getSquadMembers(squadId: string): Promise<Member[]> {
  return api.get<Member[]>(`/squads/${squadId}/members`, { cache: 'no-store' });
}

export async function bulkImportSquads(
  squads: CreateSquadInput[],
): Promise<{ created: Squad[]; errors: Array<{ row: number; message: string }> }> {
  return api.post('/squads/bulk', { squads });
}
