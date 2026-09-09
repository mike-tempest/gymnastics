import { SetMetadata } from '@nestjs/common';
import { ApiKeyScope } from '@club-manager/shared-types';

export const API_KEY_SCOPES_KEY = 'apiKeyScopes';

/**
 * Declares which read scope a route needs. A key must hold the scope to call
 * the route, so a club can issue a finance integration a key that reads
 * invoices and mandates and nothing else.
 *
 * Mirrors the @Roles decorator next door in shape, so the two read the same
 * way at a call site.
 */
export const ApiKeyScopes = (...scopes: ApiKeyScope[]) => SetMetadata(API_KEY_SCOPES_KEY, scopes);
