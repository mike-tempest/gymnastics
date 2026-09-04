'use client';

import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react';
import { ReactNode, useEffect, useRef } from 'react';

import { clearBackendToken } from '@/lib/api/api-client';

interface SessionProviderProps {
  children: ReactNode;
}

function SessionCleanup({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    // Track when user was authenticated
    if (status === 'authenticated') {
      wasAuthenticated.current = true;
    }

    // Clear backend token when user signs out
    if (status === 'unauthenticated' && wasAuthenticated.current) {
      clearBackendToken();
      wasAuthenticated.current = false;
    }
  }, [status]);

  return <>{children}</>;
}

export default function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      <SessionCleanup>{children}</SessionCleanup>
    </NextAuthSessionProvider>
  );
}
