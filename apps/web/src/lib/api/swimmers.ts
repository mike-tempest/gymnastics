import { Swimmer } from '@club-manager/shared-types';

import { api } from './api-client';

export interface CreateSwimmerInput {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  se_number?: string | null;
  governing_body?: string | null;
  family_id?: string;
  club_id?: string;
  squad_id?: string;
  medical_notes?: string;
  emergency_contact?: string;
}

export interface UpdateSwimmerInput {
  first_name?: string;
  last_name?: string;
  dob?: string;
  gender?: string;
  se_number?: string | null;
  governing_body?: string | null;
  squad_id?: string;
  medical_notes?: string;
  emergency_contact?: string;
}

export async function createSwimmer(data: CreateSwimmerInput): Promise<Swimmer> {
  return api.post<Swimmer>('/swimmers', data);
}

export async function updateSwimmer(id: string, data: UpdateSwimmerInput): Promise<Swimmer> {
  return api.patch<Swimmer>(`/swimmers/${id}`, data);
}

export async function getSwimmers(): Promise<Swimmer[]> {
  return api.get<Swimmer[]>('/swimmers', { cache: 'no-store' });
}

export async function getSwimmer(id: string): Promise<Swimmer> {
  return api.get<Swimmer>(`/swimmers/${id}`, { cache: 'no-store' });
}

export async function deleteSwimmer(id: string): Promise<void> {
  return api.delete<void>(`/swimmers/${id}`);
}

export async function bulkImportSwimmers(
  swimmers: CreateSwimmerInput[],
): Promise<{ created: Swimmer[]; errors: Array<{ row: number; message: string }> }> {
  return api.post('/swimmers/bulk', { swimmers });
}

// ==================== Filtered Queries ====================

export async function getSwimmersByFamily(familyId: string): Promise<Swimmer[]> {
  return api.get<Swimmer[]>(`/swimmers?family_id=${encodeURIComponent(familyId)}`, { cache: 'no-store' });
}

export async function getSwimmersBySquad(squadId: string): Promise<Swimmer[]> {
  return api.get<Swimmer[]>(`/swimmers?squad_id=${encodeURIComponent(squadId)}`, { cache: 'no-store' });
}

export async function getSwimmersByClub(clubId: string): Promise<Swimmer[]> {
  return api.get<Swimmer[]>(`/swimmers?club_id=${encodeURIComponent(clubId)}`, { cache: 'no-store' });
}

// ==================== Statistics ====================

export interface SwimmerStatistics {
  total: number;
  by_squad: Record<string, number>;
  by_gender: Record<string, number>;
  age_range: { min: number; max: number; average: number };
}

export async function getSwimmerStatistics(): Promise<SwimmerStatistics> {
  return api.get<SwimmerStatistics>('/swimmers/statistics', { cache: 'no-store' });
}
