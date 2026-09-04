import {
  AuditAction,
  AuditEntityType,
} from '../../modules/compliance/audit-logs/entities/audit-log.entity';

/**
 * Pure helpers that turn an inbound HTTP request into an audit record.
 *
 * These are deliberately free of Nest and request objects so the mapping rules
 * can be unit tested directly, which matters because a wrong mapping produces
 * silently misleading activity data rather than a visible failure.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route prefixes that must never be audited.
 *
 * - health/metrics: polled continuously by Railway, pure noise.
 * - the audit log's own read endpoints: reading the audit trail would append to
 *   the audit trail, so a single dashboard visit could write hundreds of rows.
 * - auth/login and auth/register-club: audited explicitly in AuthService, where
 *   the club_id and user identity are known. Auditing them here as well would
 *   double-count every signup.
 * - webhooks: machine-to-machine traffic with no acting user, and club_id is
 *   resolved deep inside the handler rather than from a JWT.
 */
const NEVER_AUDIT = [
  'health',
  'metrics',
  'compliance/audit-logs',
  'auth/login',
  'auth/logout',
  'auth/register',
  'auth/register-club',
  'auth/refresh',
  'auth/me',
  'webhooks',
  'testing',
];

/**
 * Longest-prefix-first mapping from route segment to audited entity type.
 *
 * Order matters: `compliance/dbs` must be tested before `compliance`, so the
 * table is sorted by specificity at module load rather than relying on authors
 * to keep it in the right order by hand.
 */
const ROUTE_ENTITY_MAP: ReadonlyArray<[string, AuditEntityType]> = [
  ['swimmers', AuditEntityType.SWIMMER],
  ['squads', AuditEntityType.SQUAD],
  ['sessions', AuditEntityType.SESSION],
  ['attendance', AuditEntityType.ATTENDANCE],
  ['families', AuditEntityType.FAMILY],
  ['users', AuditEntityType.USER],
  ['parent', AuditEntityType.USER],
  ['auth', AuditEntityType.USER],
  ['clubs', AuditEntityType.CLUB],
  ['admin/settings', AuditEntityType.SETTINGS],
  ['admin', AuditEntityType.SETTINGS],
  ['invoices', AuditEntityType.INVOICE],
  ['fee-structures', AuditEntityType.FEE_STRUCTURE],
  ['finance/invoices', AuditEntityType.INVOICE],
  ['finance/payments', AuditEntityType.PAYMENT],
  ['finance', AuditEntityType.INVOICE],
  ['payments', AuditEntityType.PAYMENT],
  ['mandates', AuditEntityType.MANDATE],
  ['compliance/dbs', AuditEntityType.DBS_CHECK],
  ['compliance/consents', AuditEntityType.CONSENT],
  ['compliance/safeguarding', AuditEntityType.REPORT],
  ['compliance', AuditEntityType.REPORT],
  ['communications', AuditEntityType.MESSAGE],
  ['competitions', AuditEntityType.COMPETITION],
  ['waitlist', AuditEntityType.WAITLIST],
  ['wellbeing', AuditEntityType.WELLBEING],
  ['import', AuditEntityType.DOCUMENT],
];

const SORTED_ROUTE_ENTITY_MAP = [...ROUTE_ENTITY_MAP].sort(
  (a, b) => b[0].split('/').length - a[0].split('/').length || b[0].length - a[0].length,
);

const METHOD_ACTION_MAP: Readonly<Record<string, AuditAction>> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
  GET: AuditAction.VIEW,
};

/**
 * Strip the global `api` prefix, query string and surrounding slashes so the
 * remaining string is a bare route path such as `swimmers/<uuid>`.
 */
export function normalisePath(url: string): string {
  const withoutQuery = url.split('?')[0];
  const trimmed = withoutQuery.replace(/^\/+|\/+$/g, '');
  return trimmed.replace(/^api\//, '');
}

/**
 * True when this request should produce an audit row.
 *
 * `logViews` gates read traffic. Mutations are always audited (they are the
 * compliance-relevant events); GETs are optional because they are far higher
 * volume and are only useful for product analytics.
 */
export function shouldAudit(method: string, url: string, logViews: boolean): boolean {
  const path = normalisePath(url);
  if (!path) return false;

  if (NEVER_AUDIT.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }

  const action = resolveAction(method);
  if (!action) return false;
  if (action === AuditAction.VIEW && !logViews) return false;

  return resolveEntityType(url) !== null;
}

export function resolveAction(method: string): AuditAction | null {
  return METHOD_ACTION_MAP[method?.toUpperCase()] ?? null;
}

/**
 * Map a request path to the entity type it acts on, or null when the route is
 * not something we can attribute (in which case it is not audited at all,
 * rather than being filed under a misleading type).
 */
export function resolveEntityType(url: string): AuditEntityType | null {
  const path = normalisePath(url);
  if (!path) return null;

  for (const [prefix, entityType] of SORTED_ROUTE_ENTITY_MAP) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return entityType;
    }
  }
  return null;
}

/**
 * Pull a resource id out of the path when one is present.
 *
 * `audit_logs.entity_id` is a uuid column, so anything that is not a valid uuid
 * (`swimmers/search`, `sessions/upcoming`) must resolve to undefined rather
 * than being written and rejected by Postgres.
 */
export function resolveEntityId(url: string): string | undefined {
  const path = normalisePath(url);
  const segments = path.split('/');
  // Search from the end: `swimmers/<id>/notes` should still resolve `<id>`.
  for (let i = segments.length - 1; i >= 0; i--) {
    if (UUID_PATTERN.test(segments[i])) {
      return segments[i];
    }
  }
  return undefined;
}

/**
 * A short human-readable summary, e.g. "CREATE SWIMMER via POST /api/swimmers".
 */
export function describeRequest(method: string, url: string): string {
  const action = resolveAction(method);
  const entityType = resolveEntityType(url);
  return `${action ?? method} ${entityType ?? 'UNKNOWN'} via ${method.toUpperCase()} ${
    url.split('?')[0]
  }`;
}
