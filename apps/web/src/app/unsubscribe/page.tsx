'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { api } from '@/lib/api/api-client';

type UnsubscribeState = 'working' | 'done' | 'invalid' | 'error';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  const [state, setState] = useState<UnsubscribeState>('working');

  useEffect(() => {
    if (!email || !token) {
      setState('invalid');
      return;
    }
    api
      .post<{ unsubscribed: boolean }>('/unsubscribe', { email, token })
      .then(() => setState('done'))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : '';
        setState(message.includes('Invalid') ? 'invalid' : 'error');
      });
  }, [email, token]);

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm p-10 text-center">
        <h1 className="font-serif text-3xl text-dark-primary mb-4">Swimly</h1>
        {state === 'working' && <p className="text-grey-600">Updating your email preferences...</p>}
        {state === 'done' && (
          <>
            <p className="text-dark-primary font-semibold mb-2">You are unsubscribed</p>
            <p className="text-grey-600 text-sm">
              {email} will no longer receive updates or reminders from Swimly. Emails about your
              account, invoices and sessions are unaffected.
            </p>
          </>
        )}
        {state === 'invalid' && (
          <>
            <p className="text-dark-primary font-semibold mb-2">This link is not valid</p>
            <p className="text-grey-600 text-sm">
              Please use the unsubscribe link from a recent email. If it keeps failing, contact
              your club and they will sort it for you.
            </p>
          </>
        )}
        {state === 'error' && (
          <>
            <p className="text-dark-primary font-semibold mb-2">Something went wrong</p>
            <p className="text-grey-600 text-sm">
              We could not update your preferences just now. Please try the link again shortly, or
              contact your club.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
