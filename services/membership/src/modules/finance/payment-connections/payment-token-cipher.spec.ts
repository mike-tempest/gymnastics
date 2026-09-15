import { ConfigService } from '@nestjs/config';
import { PaymentTokenCipher } from './payment-token-cipher';

describe('PaymentTokenCipher', () => {
  const keys = { v1: 'ab'.repeat(32), v2: 'cd'.repeat(32) };
  const cipher = (id = 'v1') =>
    new PaymentTokenCipher(
      new ConfigService({ PAYMENT_TOKEN_KEYS: JSON.stringify(keys), PAYMENT_TOKEN_KEY_ID: id }),
    );
  it('round-trips and uses fresh nonces', () => {
    const a = cipher().encrypt('secret', 'club:account:false');
    const b = cipher().encrypt('secret', 'club:account:false');
    expect(a.encrypted).not.toBe(b.encrypted);
    expect(a.encrypted).not.toContain('secret');
    expect(cipher().decrypt(a.encrypted, a.keyId, 'club:account:false')).toBe('secret');
  });
  it('rejects ciphertext copied to another club/account/environment', () => {
    const a = cipher().encrypt('secret', 'club:account:false');
    for (const context of ['other:account:false', 'club:other:false', 'club:account:true']) {
      expect(() => cipher().decrypt(a.encrypted, a.keyId, context)).toThrow();
    }
  });
  it('rejects tampering, missing keys and unsupported envelopes', () => {
    const a = cipher().encrypt('secret', 'context');
    expect(() => cipher().decrypt('broken', a.keyId, 'context')).toThrow();
    expect(() => cipher().decrypt(a.encrypted, 'missing', 'context')).toThrow();
    const parts = a.encrypted.split('.');
    parts[1] = Buffer.alloc(16).toString('base64');
    expect(() => cipher().decrypt(parts.join('.'), a.keyId, 'context')).toThrow();
  });
  it('reads old tokens after rotation while new writes use the new key', () => {
    const old = cipher().encrypt('secret', 'context');
    expect(cipher('v2').decrypt(old.encrypted, old.keyId, 'context')).toBe('secret');
    expect(cipher('v2').encrypt('next', 'context').keyId).toBe('v2');
  });
});
