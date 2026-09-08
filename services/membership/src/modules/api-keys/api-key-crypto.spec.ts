import { createHash } from 'crypto';
import {
  apiKeyPrefixOf,
  generateApiKey,
  hashApiKeySecret,
  parseApiKey,
  verifyApiKeySecret,
} from './api-key-crypto';

/**
 * Key material properties for the read API (TEM-32).
 *
 * These assertions are the ones worth breaking a build over: that generated
 * keys are unique and long enough to be unguessable, that the stored form is
 * a digest rather than the credential, and that a malformed credential is
 * rejected before it can reach a database lookup.
 */
describe('API key material', () => {
  describe('generateApiKey', () => {
    it('produces a credential of the documented shape', () => {
      const { prefix, plaintext } = generateApiKey();

      expect(prefix).toMatch(/^gymk_[0-9a-f]{16}$/);
      expect(plaintext.startsWith(`${prefix}.`)).toBe(true);
    });

    it('never stores the secret, only its digest', () => {
      const { hash, plaintext } = generateApiKey();
      const secret = plaintext.split('.')[1];

      expect(hash).toBe(createHash('sha256').update(secret, 'utf8').digest('hex'));
      expect(hash).not.toBe(secret);
      expect(hash).toHaveLength(64);
    });

    it('carries at least 256 bits of secret entropy', () => {
      const secret = generateApiKey().plaintext.split('.')[1];

      // 32 random bytes in base64url is 43 characters with no padding.
      expect(Buffer.from(secret, 'base64url')).toHaveLength(32);
    });

    it('does not repeat a prefix or a secret across a large run', () => {
      const prefixes = new Set<string>();
      const secrets = new Set<string>();

      for (let i = 0; i < 1000; i += 1) {
        const { prefix, plaintext } = generateApiKey();
        prefixes.add(prefix);
        secrets.add(plaintext.split('.')[1]);
      }

      expect(prefixes.size).toBe(1000);
      expect(secrets.size).toBe(1000);
    });
  });

  describe('parseApiKey', () => {
    it('splits a well formed credential into its two halves', () => {
      const { prefix, plaintext } = generateApiKey();

      expect(parseApiKey(plaintext)).toEqual({
        prefix,
        secret: plaintext.split('.')[1],
      });
    });

    it('tolerates surrounding whitespace, which a copy and paste often carries', () => {
      const { prefix, plaintext } = generateApiKey();

      expect(parseApiKey(`  ${plaintext}\n`)?.prefix).toBe(prefix);
    });

    it.each([
      ['an empty string', ''],
      ['no separator', 'gymk_0123456789abcdef'],
      ['an empty secret', 'gymk_0123456789abcdef.'],
      ['an empty prefix', '.somesecret'],
      ['two separators', 'gymk_0123456789abcdef.a.b'],
      ['a foreign namespace', 'sk_0123456789abcdef.somesecret'],
      ['a short prefix', 'gymk_0123.somesecret'],
      ['a non-hex prefix', 'gymk_zzzzzzzzzzzzzzzz.somesecret'],
    ])('rejects %s', (_label, candidate) => {
      expect(parseApiKey(candidate)).toBeNull();
    });
  });

  describe('verifyApiKeySecret', () => {
    it('accepts the secret it was generated from', () => {
      const { hash, plaintext } = generateApiKey();

      expect(verifyApiKeySecret(plaintext.split('.')[1], hash)).toBe(true);
    });

    it('rejects a different secret', () => {
      const { hash } = generateApiKey();
      const other = generateApiKey().plaintext.split('.')[1];

      expect(verifyApiKeySecret(other, hash)).toBe(false);
    });

    it('rejects rather than throwing on an absent or malformed stored hash', () => {
      const secret = generateApiKey().plaintext.split('.')[1];

      expect(verifyApiKeySecret(secret, '')).toBe(false);
      expect(verifyApiKeySecret(secret, 'too-short')).toBe(false);
      expect(verifyApiKeySecret(secret, undefined as unknown as string)).toBe(false);
    });

    it('compares the digest, so the raw secret length never reaches the comparison', () => {
      const { hash } = generateApiKey();

      // A secret of wildly different length must still compare cleanly rather
      // than throwing out of timingSafeEqual on a length mismatch.
      expect(() => verifyApiKeySecret('a', hash)).not.toThrow();
      expect(() => verifyApiKeySecret('a'.repeat(10_000), hash)).not.toThrow();
    });
  });

  describe('hashApiKeySecret', () => {
    it('is stable for the same input and different for different inputs', () => {
      expect(hashApiKeySecret('abc')).toBe(hashApiKeySecret('abc'));
      expect(hashApiKeySecret('abc')).not.toBe(hashApiKeySecret('abd'));
    });
  });

  describe('apiKeyPrefixOf', () => {
    it('returns the non-secret half only', () => {
      const { prefix, plaintext } = generateApiKey();
      const extracted = apiKeyPrefixOf(plaintext);

      expect(extracted).toBe(prefix);
      expect(plaintext.split('.')[1]).not.toContain(extracted as string);
    });

    it('returns null for anything that is not one of our credentials', () => {
      expect(apiKeyPrefixOf(undefined)).toBeNull();
      expect(apiKeyPrefixOf(null)).toBeNull();
      expect(apiKeyPrefixOf('')).toBeNull();
      expect(apiKeyPrefixOf('Bearer some.jwt.token')).toBeNull();
    });
  });
});
