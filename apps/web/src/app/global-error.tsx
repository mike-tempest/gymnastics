'use client';

import { useEffect } from 'react';

import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // global-error replaces the root layout, so we import globals.css here to make
  // the Tailwind tokens available on this bare document.
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="m-0 flex min-h-screen items-center justify-center bg-canvas p-4 font-sans">
        <main
          role="alert"
          className="max-w-md rounded-card bg-dark-primary p-10 text-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mx-auto mb-6 block text-danger"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>

          <h1 className="mb-3 font-serif text-2xl font-normal text-grey-50">
            Something went wrong
          </h1>

          <p className="mb-8 leading-relaxed text-grey-300">
            A critical error occurred. Please try again, or contact your club
            administrator if the problem persists.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex min-h-[44px] items-center rounded-button bg-brand px-6 py-3 text-base font-semibold text-dark-primary transition-colors hover:bg-brand-dark"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex min-h-[44px] items-center rounded-button border border-grey-50/10 bg-transparent px-6 py-3 text-base font-semibold text-grey-300 transition-colors hover:bg-grey-50/5"
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
