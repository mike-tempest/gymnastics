import type { DirectDebitMandate } from '@club-manager/shared-types';

import { api } from './api-client';

/**
 * Parent-scoped Direct Debit setup (TEM-22).
 *
 * The admin routes in lib/api/mandates.ts take a family_id and are SUPER_ADMIN
 * only, so a parent could never set up their own mandate. These two calls take
 * the family from the caller's session instead, which means nothing here sends
 * a family id at all.
 *
 * The session token is minted and signed by the server. The browser only
 * carries it across the provider redirect and hands it back, and the server
 * verifies it belongs to this family and has not expired. Do not generate one
 * on the client.
 */

export interface ParentRedirectFlowResponse {
  redirect_flow_id: string;
  redirect_url: string;
  session_token: string;
}

/** Where the browser stores the token while the payer is at the provider. */
const SESSION_TOKEN_KEY = 'parent_mandate_session_token';

export async function startParentMandateSetup(
  successRedirectUrl: string
): Promise<ParentRedirectFlowResponse> {
  const response = await api.post<ParentRedirectFlowResponse>('/parent/mandates/setup/start', {
    success_redirect_url: successRedirectUrl,
  });
  sessionStorage.setItem(SESSION_TOKEN_KEY, response.session_token);
  return response;
}

export async function completeParentMandateSetup(
  redirectFlowId: string
): Promise<DirectDebitMandate> {
  const sessionToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!sessionToken) {
    throw new Error('This Direct Debit setup could not be matched to your session. Start again.');
  }
  const mandate = await api.post<DirectDebitMandate>('/parent/mandates/setup/complete', {
    redirect_flow_id: redirectFlowId,
    session_token: sessionToken,
  });
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  return mandate;
}
