'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useEffect, useRef } from 'react';

import { capturePageview, identifyUser, resetIdentity, setClubGroup } from '@/lib/analytics';

// Importing the posthog module triggers the SDK to initialise at module-load
// time (see src/lib/posthog.ts). This import is here purely to make sure the
// module evaluates as part of the layout's bundle, even if no other module on
// the page chain references it directly.
import '@/lib/posthog';

/**
 * Identifies the user when the NextAuth session resolves, captures pageviews
 * on App Router navigation, and resets the identity on signout. PostHog
 * itself initialises at module-load time in src/lib/posthog.ts.
 */
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionIdentifier />
      {/* useSearchParams needs a Suspense boundary to avoid a build-time CSR
          bailout warning in Next.js App Router. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}

// -----------------------------------------------------------------------
// SessionIdentifier
// -----------------------------------------------------------------------

function SessionIdentifier() {
  const { data: session, status } = useSession();
  const lastIdentifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated' && session?.user?.id) {
      // Only re-identify when the user changes (avoids duplicate identify
      // calls on every component re-render).
      if (lastIdentifiedUserId.current === session.user.id) return;
      identifyUser(session.user.id, { role: String(session.user.role) });
      if (session.user.clubId) setClubGroup(session.user.clubId);
      lastIdentifiedUserId.current = session.user.id;
      return;
    }

    if (status === 'unauthenticated' && lastIdentifiedUserId.current) {
      // User signed out: clear the anonymous tail so we don't merge the next
      // visitor's events under the previous user.
      resetIdentity();
      lastIdentifiedUserId.current = null;
    }
  }, [status, session?.user?.id, session?.user?.role, session?.user?.clubId]);

  return null;
}

// -----------------------------------------------------------------------
// PageviewTracker
// -----------------------------------------------------------------------

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams?.toString();
    const path = search ? `${pathname}?${search}` : pathname;
    capturePageview(path);
  }, [pathname, searchParams]);

  return null;
}
