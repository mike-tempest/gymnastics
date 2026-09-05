'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex h-dvh items-center justify-center bg-dark-primary p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Import failed</h2>
        <p className="text-text-secondary mb-6">{error.message || 'An error occurred whilst loading the import page. Please try again.'}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all">Try Again</button>
          <Link href="/members" className="px-6 py-3 min-h-[44px] rounded-xl font-semibold text-text-secondary border border-white/20 hover:border-brand hover:text-white transition-all inline-flex items-center justify-center">Back to Members</Link>
        </div>
      </div>
    </div>
  );
}
