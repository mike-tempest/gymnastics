// Typed analytics helpers.
//
// Single point of entry for capturing product events. All Tier 1 events
// from docs/analytics-strategy.md are typed here so call sites cannot
// drift from the agreed taxonomy.
//
// All functions are safe to call when PostHog is not initialised - they
// silently no-op. That means feature code can call them unconditionally
// without import-time or runtime checks.
//
// PII rule: never pass any free-text user input, email, name, phone, DOB
// or address. Property values must be UUIDs, enums, counts, booleans, or
// short controlled-vocabulary strings.

// Importing the posthog module triggers SDK init (see src/lib/posthog.ts).
// Use the posthog instance directly rather than going through a wrapper that
// reads a module-local flag - in production Next.js bundling that flag can
// end up in a different chunk than this module, so a guarded read sees
// `false` even though the SDK is actually live.
// eslint-disable-next-line import/no-named-as-default
import posthog from 'posthog-js';
import './posthog';

// -----------------------------------------------------------------------
// Identification
// -----------------------------------------------------------------------

function isClient(): boolean {
  return typeof window !== 'undefined';
}

export function identifyUser(userId: string, traits: { role: string }) {
  if (!isClient()) return;
  // Identify the user by their stable UUID. role is the only person trait
  // we set here - email/name stays out of analytics.
  posthog.identify(userId, { role: traits.role });
}

export function setClubGroup(clubId: string) {
  if (!isClient()) return;
  // Group the current user under their club so PostHog can roll up
  // per-club metrics. We do not pass any club name or details, only the id.
  posthog.group('club', clubId);
}

export function resetIdentity() {
  if (!isClient()) return;
  posthog.reset();
}

// -----------------------------------------------------------------------
// Pageviews
// -----------------------------------------------------------------------

export function capturePageview(path: string) {
  if (!isClient()) return;
  posthog.capture('$pageview', { $current_url: window.location.href, path });
}

// -----------------------------------------------------------------------
// Tier 1 events - signup
// -----------------------------------------------------------------------

export function signupStarted() {
  capture('signup_started', {});
}

export function signupFieldFocused(fieldName: SignupField) {
  capture('signup_field_focused', { field_name: fieldName });
}

export function signupSubmitted() {
  capture('signup_submitted', {});
}

export function signupSucceeded(props: {
  club_id: string;
  has_affiliation: boolean;
  has_region: boolean;
}) {
  capture('signup_succeeded', props);
}

export function signupFailed(reason: SignupFailureReason) {
  capture('signup_failed', { reason });
}

// The dead end from the UX audit: club created but auto-signin failed.
export function signinAfterSignupFailed() {
  capture('signin_after_signup_failed', {});
}

// -----------------------------------------------------------------------
// Tier 1 events - onboarding wizard
// -----------------------------------------------------------------------

export function onboardingStarted() {
  capture('onboarding_started', {});
}

export function onboardingStepViewed(step: OnboardingStep) {
  capture('onboarding_step_viewed', { step_index: step.index, step_name: step.name });
}

export function onboardingStepSkipped(step: OnboardingStep) {
  capture('onboarding_step_skipped', { step_index: step.index, step_name: step.name });
}

export function onboardingStepCompleted(step: OnboardingStep, msOnStep: number) {
  capture('onboarding_step_completed', {
    step_index: step.index,
    step_name: step.name,
    ms_on_step: msOnStep,
  });
}

export function onboardingExited(props: { step_index: number; exit_type: OnboardingExitType }) {
  capture('onboarding_exited', props);
}

export function onboardingLaunched(props: {
  ms_total: number;
  steps_completed: number;
  steps_skipped: number;
}) {
  capture('onboarding_launched', props);
}

// -----------------------------------------------------------------------
// Controlled vocabularies
// -----------------------------------------------------------------------

export type SignupField =
  | 'clubName'
  | 'swimEnglandRegion'
  | 'affiliateNumber'
  | 'county'
  | 'clubContactEmail'
  | 'clubPhone'
  | 'website'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword';

export type SignupFailureReason = 'email_taken' | 'slug_taken' | 'validation' | 'server_error';

export type OnboardingExitType = 'skip_setup_and_explore' | 'navigated_away' | 'logout';

export interface OnboardingStep {
  index: number;
  name: 'club_details' | 'venues' | 'squads' | 'import_members' | 'invite_staff' | 'review';
}

// -----------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------

function capture(event: string, properties: Record<string, unknown>) {
  if (!isClient()) return;
  posthog.capture(event, properties);
}
