import { api } from './api-client';

/**
 * Payment-provider connection state for the admin settings page. Mirrors the
 * membership service's /admin/settings/payments endpoints: clubs connect
 * their own provider account (Stripe Connect first), so funds go directly to
 * the club and Swimly never holds a club's API keys.
 */

export type PaymentProvider = 'stripe' | 'gocardless';

export type PaymentConnectionStatus = 'none' | 'pending' | 'active' | 'restricted' | 'disconnected';

export interface PaymentConnectionCapabilities {
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due: string[];
}

export interface PaymentConnection {
  /** False when the Swimly environment has no platform credentials at all. */
  configured: boolean;
  provider: PaymentProvider | null;
  status: PaymentConnectionStatus;
  /** Null until a Stripe account exists; false means a Stripe TEST account. */
  livemode: boolean | null;
  external_account_id: string | null;
  capabilities: PaymentConnectionCapabilities | null;
}

export async function getPaymentConnection(): Promise<PaymentConnection> {
  return api.get<PaymentConnection>('/admin/settings/payments/connection');
}

/**
 * Mint a Stripe-hosted onboarding link for the club's connected account.
 * The caller must redirect the browser to the returned URL. The backend
 * returns a fresh link every time, so this also serves "continue setup".
 */
export async function startStripeConnect(): Promise<{ url: string }> {
  return api.post<{ url: string }>('/admin/settings/payments/stripe/connect');
}

/** Re-fetch the connected account's status from Stripe. */
export async function syncStripeConnection(): Promise<PaymentConnection> {
  return api.post<PaymentConnection>('/admin/settings/payments/stripe/sync');
}
