'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { isAuthenticated, getUser, hasAnyRole } from '@/lib/auth-utils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ('ADMIN' | 'COACH' | 'PARENT')[];
  fallbackUrl?: string;
}

export default function ProtectedRoute({
  children,
  requiredRoles,
  fallbackUrl = '/login',
}: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      router.push(fallbackUrl);
      return;
    }

    // Check role authorization if required
    if (requiredRoles && requiredRoles.length > 0) {
      if (!hasAnyRole(requiredRoles)) {
        // User is authenticated but doesn't have required role
        const user = getUser();
        if (user) {
          // Redirect to appropriate dashboard for their role
          if (user.role === 'ADMIN') {
            router.push('/admin');
          } else if (user.role === 'COACH') {
            router.push('/coach');
          } else {
            router.push('/parent');
          }
        } else {
          router.push(fallbackUrl);
        }
        return;
      }
    }

    setIsAuthorized(true);
    setIsChecking(false);
  }, [router, requiredRoles, fallbackUrl]);

  // Show loading while checking authorization
  if (isChecking) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  // Render children only if authorized
  return isAuthorized ? <>{children}</> : null;
}
