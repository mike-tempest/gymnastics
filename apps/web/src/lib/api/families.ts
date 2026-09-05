import { Family } from '@club-manager/shared-types';

import { api } from './api-client';

export interface CreateFamilyData {
  family_name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
}

export interface UpdateFamilyData extends Partial<CreateFamilyData> {}

export async function getFamilies(): Promise<Family[]> {
  return api.get<Family[]>('/families', { cache: 'no-store' });
}

export async function getFamily(id: string): Promise<Family> {
  return api.get<Family>(`/families/${id}`, { cache: 'no-store' });
}

export async function createFamily(data: CreateFamilyData): Promise<Family> {
  return api.post<Family>('/families', data);
}

export async function updateFamily(id: string, data: UpdateFamilyData): Promise<Family> {
  return api.patch<Family>(`/families/${id}`, data);
}

export async function deleteFamily(id: string): Promise<void> {
  return api.delete<void>(`/families/${id}`);
}

export async function getFamilyStatistics() {
  return api.get('/families/statistics', { cache: 'no-store' });
}

export async function generateInvite(familyId: string): Promise<{ token: string; inviteUrl: string }> {
  return api.post<{ token: string; inviteUrl: string }>(`/families/${familyId}/invite`);
}

export async function acceptInvite(data: { token: string; userId?: string }): Promise<Family> {
  return api.post<Family>('/families/invite/accept', data);
}

export async function verifyInviteToken(token: string): Promise<{ valid: boolean; family?: Family }> {
  return api.get<{ valid: boolean; family?: Family }>(`/families/invite/verify/${token}`, {
    cache: 'no-store',
  });
}
