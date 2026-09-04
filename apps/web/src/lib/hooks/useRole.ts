'use client';

import { UserRole } from '@swim-nexus/shared-types';
import { useSession } from 'next-auth/react';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.TREASURER];

const COACH_ROLES: UserRole[] = [UserRole.HEAD_COACH, UserRole.SQUAD_COACH];

const PARENT_ROLES: UserRole[] = [UserRole.PARENT];

/**
 * Hook that returns the current user's role from the NextAuth session.
 */
export function useRole() {
  const { data: session, status } = useSession();

  return {
    role: session?.user?.role ?? null,
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  };
}

/**
 * Extracts the user role from a NextAuth session object.
 * Useful outside of React components where hooks cannot be used.
 */
export function getUserRole(session: { user?: { role?: UserRole } } | null): UserRole | null {
  return session?.user?.role ?? null;
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role != null && ADMIN_ROLES.includes(role);
}

export function isCoach(role: UserRole | null | undefined): boolean {
  return role != null && COACH_ROLES.includes(role);
}

export function isParent(role: UserRole | null | undefined): boolean {
  return role != null && PARENT_ROLES.includes(role);
}

export function isAdminOrCoach(role: UserRole | null | undefined): boolean {
  return isAdmin(role) || isCoach(role);
}

export { ADMIN_ROLES, COACH_ROLES, PARENT_ROLES };
