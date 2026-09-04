/**
 * Thin wrapper around full-page redirects. jsdom's window.location is
 * non-configurable, so components that hand the browser to an external
 * hosted page (Stripe onboarding, checkout) call this instead and tests
 * mock this module the same way they mock lib/api modules.
 */
export function redirectTo(url: string): void {
  window.location.href = url;
}
