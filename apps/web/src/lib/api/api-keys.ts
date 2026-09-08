import type { ApiKeyCreatedResponse, ApiKeyScope, ApiKeySummary } from '@club-manager/shared-types';

import { api } from './api-client';

/**
 * Club read API keys (TEM-32).
 *
 * A club owns its data, so it can mint a key, read its own records through
 * the published API, and revoke the key when it is done. The plaintext
 * credential exists only in the create response; there is deliberately no
 * endpoint to fetch it again.
 */

export type { ApiKeyCreatedResponse, ApiKeySummary };

export interface CreateApiKeyPayload {
  label: string;
  scopes: ApiKeyScope[];
}

/** Every key belonging to the club, revoked ones included. Never a secret. */
export function listApiKeys(): Promise<ApiKeySummary[]> {
  return api.get<ApiKeySummary[]>('/api-keys');
}

/**
 * Mints a key. The response carries the only copy of the plaintext
 * credential that will ever exist, so the caller must show it immediately.
 */
export function createApiKey(payload: CreateApiKeyPayload): Promise<ApiKeyCreatedResponse> {
  return api.post<ApiKeyCreatedResponse>('/api-keys', payload);
}

/**
 * Revokes a key. Takes effect on the very next request the key makes. The
 * record is kept, with a revoked timestamp, so the club keeps an audit trail
 * of what once had access.
 */
export function revokeApiKey(apiKeyId: string): Promise<ApiKeySummary> {
  return api.delete<ApiKeySummary>(`/api-keys/${apiKeyId}`);
}
