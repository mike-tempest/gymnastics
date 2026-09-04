// PostHog client init.
//
// Initialised SYNCHRONOUSLY at module-load time so any capture call from
// anywhere in the app sees a ready SDK, regardless of useEffect ordering.
// (React runs child useEffects before parent useEffects, so a Provider-driven
// init would race with page-level capture calls and drop the first events.)
//
// Reads NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST. If either is
// missing, init is skipped and all subsequent capture/identify calls in
// src/lib/analytics.ts are silent no-ops. That means local dev and preview
// builds work without analytics; prod fires only when the keys are set.

// eslint-disable-next-line import/no-named-as-default
import posthog, { type PostHog } from 'posthog-js';

let initialised = false;

// Module-level guard: only run in the browser. typeof window === 'undefined'
// during SSR, so this is skipped on the server.
if (typeof window !== 'undefined') {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';
  if (key) {
    posthog.init(key, {
      api_host: host,
      // Capture events for anonymous visitors too, not just identified users.
      // Without this the SDK respects the PostHog project default which is
      // "identified_only" mode and silently drops the entire pre-signup
      // funnel (signup_started, signup_submitted, etc.) - exactly the
      // population we most want to measure.
      person_profiles: 'always',
      // We track pageviews manually because the App Router does client-side
      // navigation that the default capture_pageview does not pick up.
      capture_pageview: false,
      // Autocapture catches button clicks and form interactions without
      // hand-instrumentation. Useful for early product; can be tightened later.
      autocapture: true,
      // Session recording is OFF at the SDK level for Phase 1. Phase 4 will
      // enable it selectively for the onboarding flow only.
      disable_session_recording: true,
      // Mask all inputs by default so if recording is later enabled we don't
      // accidentally capture PII.
      session_recording: { maskAllInputs: true },
      persistence: 'localStorage+cookie',
      loaded: (instance) => {
        if (process.env.NODE_ENV === 'development') {
          instance.debug();
        }
      },
    });
    initialised = true;
  }
}

export function getPostHog(): PostHog | null {
  if (typeof window === 'undefined') return null;
  return initialised ? posthog : null;
}
