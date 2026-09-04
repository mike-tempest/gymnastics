'use client';

import { ArrowLeft, Home, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-4">
      <main className="text-center max-w-md">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
          <Search className="h-10 w-10 text-brand" aria-hidden="true" />
        </div>
        <h1 className="text-7xl font-bold text-brand mb-3">404</h1>
        <h2 className="text-2xl font-semibold text-dark-primary mb-2">
          Page not found
        </h2>
        <p className="text-text-secondary mb-8 leading-relaxed">
          Sorry, we couldn&apos;t find the page you were looking for. It may
          have been moved or no longer exists.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-brand text-dark-primary font-semibold px-6 py-3 min-h-[44px] rounded-button hover:bg-brand-light transition-all shadow-sm"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go home
          </Link>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-button font-semibold text-dark-primary/60 border border-dark-primary/20 hover:border-brand hover:text-dark-primary transition-all"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Go back
          </button>
        </div>
      </main>
    </div>
  );
}
