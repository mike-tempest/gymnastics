import { UserRole } from '@club-manager/shared-types';
import { useSession } from 'next-auth/react';

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    role: session?.user?.role,
  };
}

export function useRole(allowedRoles: UserRole[]) {
  const { user, isAuthenticated, isLoading } = useAuth();

  const hasRole = isAuthenticated && user?.role && allowedRoles.includes(user.role);

  return {
    hasRole,
    isLoading,
    isAuthenticated,
  };
}

export function useIsSuperAdmin() {
  return useRole([UserRole.SUPER_ADMIN]);
}

export function useIsAdmin() {
  return useRole([UserRole.SUPER_ADMIN, UserRole.TREASURER, UserRole.HEAD_COACH]);
}
