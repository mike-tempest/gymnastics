import { api } from './api-client';

/**
 * The authenticated user's club as returned by GET /clubs/me.
 * Regional fields are optional: older backends omit them entirely, so all
 * consumers must fall back to GB defaults when they are missing.
 */
export interface MyClub {
  id: string;
  name: string;
  country?: string;
  currency?: string;
  timezone?: string;
  locale?: string;
  governing_body?: string | null;
  governing_body_region?: string | null;
  // Tax presentation fields. Optional for the same reason as the regional
  // fields: older backends omit them, and consumers must treat their absence
  // as "no tax configured" (label null, exclusive pricing, no registration).
  tax_label?: string | null;
  tax_inclusive?: boolean;
  tax_registration_number?: string | null;
  // Payment provider the club collects with. Optional for the same reason:
  // older backends omit it. Null or absent means no provider is connected,
  // and consumers must keep today's GoCardless direct-debit copy.
  payment_provider?: 'stripe' | 'gocardless' | null;
}

export async function getMyClub(): Promise<MyClub> {
  return api.get<MyClub>('/clubs/me');
}
