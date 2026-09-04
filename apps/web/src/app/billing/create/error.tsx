'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex h-dvh items-center justify-center bg-dark-primary p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Failed to load billing</h2>
        <p className="text-text-secondary mb-6">{error.message || 'An error occurred. Please try again.'}</p>
        <button onClick={reset} className="px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all">Try Again</button>
      </div>
    </div>
  );
}
