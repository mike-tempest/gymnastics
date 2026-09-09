import { UserRole } from '@club-manager/shared-types';

import { api } from './api-client';
import { type UserProfile } from './auth';

export const STAFF_ROLES = [
  UserRole.TREASURER,
  UserRole.HEAD_COACH,
  UserRole.SQUAD_COACH,
  UserRole.WELFARE_OFFICER,
  UserRole.COMPETITION_SECRETARY,
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface BulkImportStaffInput {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

/** A club user as returned by GET /users (admin and treasurer only). */
export interface ClubUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
}

export async function listUsers(): Promise<ClubUser[]> {
  return api.get<ClubUser[]>('/users', { cache: 'no-store' });
}

export async function bulkImportStaff(
  users: BulkImportStaffInput[]
): Promise<{ created: UserProfile[]; errors: Array<{ row: number; message: string }> }> {
  return api.post('/users/bulk', { users });
}

export type StaffDirectoryEntry = Pick<ClubUser, 'user_id' | 'first_name' | 'last_name' | 'role'>;

export async function listStaffDirectory(): Promise<StaffDirectoryEntry[]> {
  return api.get<StaffDirectoryEntry[]>('/users/staff-directory', { cache: 'no-store' });
}
