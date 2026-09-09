'use client';

import { useEffect, useState } from 'react';

import { probeApiReachable } from '@/lib/api/api-client';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    probeApiReachable().then((ok) => setOffline(!ok));
  }, []);

  const heading = offline ? 'Unable to connect to the server' : message;

  const detail = offline
    ? 'Check your connection and try again.'
    : 'Something went wrong. Check your connection and try again.';

  return (
    <div className="text-center py-16">
      <div className="mb-6 p-6 bg-red-500 bg-opacity-10 border border-red-500 rounded-xl max-w-md mx-auto">
        <svg
          className="w-12 h-12 mx-auto text-red-400 mb-4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {offline ? (
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
          ) : (
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          )}
        </svg>
        <p className="text-red-400 font-semibold text-lg">{heading}</p>
        <p className="text-red-400/70 text-sm mt-2">{detail}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
