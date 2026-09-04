'use client';

import { WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { probeApiReachable } from '@/lib/api/api-client';

const POLL_INTERVAL_MS = 30_000;

/**
 * Global connectivity banner. Renders a dismissible warning bar at the top of
 * the page only when the API server is genuinely unreachable.
 *
 * We confirm unreachability with a real request to the server rather than
 * trusting navigator.onLine, which reports false on many working networks
 * (captive portals, proxies, some VPNs) and used to raise this banner while
 * the app was in fact working normally.
 *
 * Drop this into your root layout or MainLayout so it covers all pages.
 */
export default function ConnectivityBanner() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const inFlight = useRef(false);

  const checkReachable = useCallback(async () => {
    // Avoid overlapping probes if a slow one is still running.
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const reachable = await probeApiReachable();
      setOffline(!reachable);
      if (reachable) setDismissed(false);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // Confirm reachability on mount rather than assuming from navigator.onLine.
    checkReachable();

    // Browser online/offline events are only hints - always verify with a real
    // probe before showing or clearing the banner.
    window.addEventListener('offline', checkReachable);
    window.addEventListener('online', checkReachable);

    // Poll so a genuine outage (or its recovery) is picked up even when no
    // network events fire.
    const interval = setInterval(checkReachable, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('offline', checkReachable);
      window.removeEventListener('online', checkReachable);
      clearInterval(interval);
    };
  }, [checkReachable]);

  if (!offline || dismissed) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-danger text-white px-4 py-3 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>Unable to connect to the server. Check your connection and try again.</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 text-white/80 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
