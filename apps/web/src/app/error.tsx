'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import ErrorState from '@/components/ui/ErrorState';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-dark-primary p-4">
      <main className="w-full max-w-md text-center" role="alert">
        <ErrorState
          message="An unexpected error occurred. Please try again, or contact your club administrator if the problem persists."
          onRetry={reset}
        />
        <Link
          href="/"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-button border border-white/10 px-6 py-3 font-semibold text-text-secondary transition-all hover:border-brand hover:text-white"
        >
          Go home
        </Link>
      </main>
    </div>
  );
}
