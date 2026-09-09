/**
 * Club-scoped read API key types shared between the membership service and
 * the web app (TEM-32).
 *
 * A club owns its data. Rule 6 of the build brief makes a full export and a
 * read API product features rather than marketing, so a club can always get
 * its own records out without asking us. These types describe the key
 * records that authenticate that read API.
 *
 * The raw secret is never modelled here except on the single response
 * returned at creation time, because it is shown exactly once and never
 * stored in recoverable form.
 */

/** Read scopes a key may be granted. Keys never grant write access. */
export enum ApiKeyScope {
  MEMBERS_READ = 'members:read',
  FAMILIES_READ = 'families:read',
  SQUADS_READ = 'squads:read',
  SESSIONS_READ = 'sessions:read',
  ATTENDANCE_READ = 'attendance:read',
  INVOICES_READ = 'invoices:read',
  MANDATES_READ = 'mandates:read',
  AWARDS_READ = 'awards:read',
}

/** Every scope, in the order the management UI lists them. */
export const ALL_API_KEY_SCOPES: ApiKeyScope[] = [
  ApiKeyScope.MEMBERS_READ,
  ApiKeyScope.FAMILIES_READ,
  ApiKeyScope.SQUADS_READ,
  ApiKeyScope.SESSIONS_READ,
  ApiKeyScope.ATTENDANCE_READ,
  ApiKeyScope.INVOICES_READ,
  ApiKeyScope.MANDATES_READ,
  ApiKeyScope.AWARDS_READ,
];

/**
 * A key as the management UI sees it. There is no secret here: once created,
 * a key is only ever identified by its non-secret prefix.
 */
export interface ApiKeySummary {
  api_key_id: string;
  club_id: string;
  /** Non-secret identifier, safe to display and to log. */
  key_prefix: string;
  /** Human label chosen by the admin, for example "Finance export script". */
  label: string;
  scopes: ApiKeyScope[];
  created_by_user_id: string | null;
  created_at: string;
  /** Null until the key has authenticated at least one request. */
  last_used_at: string | null;
  /** Null while the key is live; a timestamp once revoked. */
  revoked_at: string | null;
}

/**
 * The one and only response that carries the raw secret. It is returned by
 * the create endpoint and never again, because only a hash is stored.
 */
export interface ApiKeyCreatedResponse {
  api_key: ApiKeySummary;
  /** Full credential to send as the X-API-Key header. Shown once. */
  plaintext_key: string;
}
