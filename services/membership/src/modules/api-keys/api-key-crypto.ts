import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Key material for the club-scoped read API (TEM-32).
 *
 * The credential is two halves joined by a dot:
 *
 *   gymk_9f2c1a7b4e0d6853.tR9x...  <- prefix . secret
 *
 * The prefix is not a secret. It identifies the key for display, for the
 * database lookup and for the per-key rate limit bucket, and it is safe to
 * write to a log. The secret is 32 bytes of CSPRNG output and is shown to the
 * admin exactly once; only its SHA-256 digest is stored.
 *
 * Why a plain digest rather than bcrypt or argon2: those exist to slow down
 * guessing of low-entropy, human-chosen passwords. The secret here is 256
 * bits from `crypto.randomBytes`, so there is no dictionary to walk and no
 * structure to exploit; guessing it is not a threat a slow KDF changes. What
 * a slow KDF would change is the cost of every single API request, since the
 * guard verifies on each one. This is the same trade-off GitHub and Stripe
 * make for machine tokens.
 *
 * Nothing in this file logs, and nothing outside it should ever hold a raw
 * secret beyond the single create response.
 */

/** Prefix marker, so a leaked credential is recognisable in a scan. */
const PREFIX_NAMESPACE = 'gymk';

/** Bytes of randomness in the non-secret prefix suffix. */
const PREFIX_RANDOM_BYTES = 8;

/** Bytes of randomness in the secret. 32 bytes is 256 bits. */
const SECRET_RANDOM_BYTES = 32;

/** Separator between the two halves. Not present in base64url or hex. */
const SEPARATOR = '.';

export interface GeneratedApiKey {
  /** Non-secret identifier, persisted and displayed. */
  prefix: string;
  /** SHA-256 hex digest of the secret. Persisted. */
  hash: string;
  /** The full credential. Returned to the admin once, never persisted. */
  plaintext: string;
}

/**
 * Mints a new credential. The caller persists `prefix` and `hash`, hands
 * `plaintext` back to the admin once, and then forgets it.
 */
export function generateApiKey(): GeneratedApiKey {
  const prefix = `${PREFIX_NAMESPACE}_${randomBytes(PREFIX_RANDOM_BYTES).toString('hex')}`;
  const secret = randomBytes(SECRET_RANDOM_BYTES).toString('base64url');

  return {
    prefix,
    hash: hashApiKeySecret(secret),
    plaintext: `${prefix}${SEPARATOR}${secret}`,
  };
}

/** SHA-256 hex digest of a secret. The only hashing this module does. */
export function hashApiKeySecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/**
 * Splits a presented credential into its two halves.
 *
 * Returns null for anything that is not shaped like one of our keys, so the
 * guard can reject obvious junk before touching the database. Deliberately
 * strict: exactly one separator, both halves non-empty, the prefix within the
 * column width and matching the namespace and hex shape we mint.
 */
export function parseApiKey(presented: string): { prefix: string; secret: string } | null {
  if (typeof presented !== 'string') {
    return null;
  }

  const trimmed = presented.trim();
  const separatorIndex = trimmed.indexOf(SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex !== trimmed.lastIndexOf(SEPARATOR)) {
    return null;
  }

  const prefix = trimmed.slice(0, separatorIndex);
  const secret = trimmed.slice(separatorIndex + 1);
  if (secret.length === 0 || prefix.length > 64) {
    return null;
  }

  const expectedPrefix = new RegExp(`^${PREFIX_NAMESPACE}_[0-9a-f]{${PREFIX_RANDOM_BYTES * 2}}$`);
  if (!expectedPrefix.test(prefix)) {
    return null;
  }

  return { prefix, secret };
}

/**
 * Constant-time comparison of a presented secret against a stored digest.
 *
 * Both operands are fixed-length hex digests of the same size, so
 * `timingSafeEqual` can be used directly without leaking length. Hashing the
 * presented secret first is what makes the lengths equal: comparing raw
 * secrets of differing length would throw and would leak length through the
 * error path.
 */
export function verifyApiKeySecret(presentedSecret: string, storedHash: string): boolean {
  const presentedHash = Buffer.from(hashApiKeySecret(presentedSecret), 'utf8');
  const expectedHash = Buffer.from(storedHash ?? '', 'utf8');

  if (presentedHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(presentedHash, expectedHash);
}

/**
 * Extracts just the non-secret prefix from a presented credential, for use as
 * a rate-limit bucket key or a log field. Returns null when the credential is
 * not shaped like one of ours, so a malformed header can never be echoed
 * anywhere. Never returns any part of the secret.
 */
export function apiKeyPrefixOf(presented: string | undefined | null): string | null {
  if (!presented) {
    return null;
  }
  return parseApiKey(presented)?.prefix ?? null;
}
