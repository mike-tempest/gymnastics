'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { useClubRegion } from '@/hooks/useClubRegion';
import { paymentMethodLabel } from '@/lib/utils/region-labels';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { country } = useClubRegion();
  const methodLabel = paymentMethodLabel(country);
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex h-dvh items-center justify-center bg-dark-primary p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Payment setup issue</h2>
        <p className="text-text-secondary mb-6">{error.message || `Something went wrong completing your ${methodLabel} setup. Please try again or contact your club.`}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all">Try Again</button>
          <Link href="/" className="px-6 py-3 min-h-[44px] rounded-xl font-semibold text-text-secondary border border-white/20 hover:border-brand hover:text-white transition-all inline-flex items-center justify-center">Go Home</Link>
        </div>
      </div>
    </div>
  );
}
