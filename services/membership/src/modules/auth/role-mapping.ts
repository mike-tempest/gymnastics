import { UserRole } from '../users/entities/user.entity';

/**
 * Maps the role values the web app sends (uppercase, coarse-grained) to the
 * lowercase `UserRole` enum the backend stores.
 *
 * The register page and the create-club page send `PARENT` / `COACH` / `ADMIN`,
 * but the database enum uses values like `parent`, `head_coach`, `super_admin`.
 * Without this mapping the `@IsEnum(UserRole)` validation rejects those values,
 * which is the bug Phase 4 fixes.
 *
 * The map is intentionally permissive: it also accepts a value that is already
 * a valid enum member (so callers sending `parent` directly still work), and it
 * is case-insensitive on the frontend keys.
 */
const FRONTEND_ROLE_MAP: Record<string, UserRole> = {
  PARENT: UserRole.PARENT,
  COACH: UserRole.SQUAD_COACH,
  ADMIN: UserRole.SUPER_ADMIN,
};

const VALID_ENUM_VALUES = new Set<string>(Object.values(UserRole));

/**
 * Resolve an incoming role value (frontend label or raw enum value) to a
 * `UserRole`. Returns `undefined` when the value cannot be mapped, so callers
 * can fall back to a default rather than persisting an invalid role.
 */
export function mapRole(value: unknown): UserRole | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const raw = String(value).trim();

  // Already a valid enum value (e.g. 'parent', 'super_admin').
  if (VALID_ENUM_VALUES.has(raw)) {
    return raw as UserRole;
  }

  // Frontend label (case-insensitive), e.g. 'PARENT', 'coach'.
  const mapped = FRONTEND_ROLE_MAP[raw.toUpperCase()];
  return mapped;
}
