import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Authenticated encryption binds credentials to their club, account and mode. */
export class PaymentTokenCipher {
  constructor(private readonly config: ConfigService) {}

  private key(id: string): Buffer {
    try {
      if (!id || id.length > 64) throw new Error();
      const keys = JSON.parse(this.config.get<string>('PAYMENT_TOKEN_KEYS', '{}'));
      const value = keys[id];
      if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new Error();
      return Buffer.from(value, 'hex');
    } catch {
      throw new ServiceUnavailableException('Payment credential encryption is unavailable.');
    }
  }

  isConfigured(): boolean {
    try {
      this.key(this.config.get<string>('PAYMENT_TOKEN_KEY_ID', ''));
      return true;
    } catch {
      return false;
    }
  }

  encrypt(token: string, context: string) {
    const keyId = this.config.get<string>('PAYMENT_TOKEN_KEY_ID', '');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(keyId), iv);
    cipher.setAAD(Buffer.from(context));
    const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return {
      keyId,
      encrypted: [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.'),
    };
  }

  decrypt(encrypted: string | null, keyId: string | null, context: string): string {
    try {
      if (!encrypted || !keyId) throw new Error();
      const parts = encrypted.split('.');
      if (parts.length !== 3) throw new Error();
      const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64'));
      const cipher = createDecipheriv('aes-256-gcm', this.key(keyId), iv);
      cipher.setAAD(Buffer.from(context));
      cipher.setAuthTag(tag);
      return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'Payment credentials could not be read. Please contact support.',
      );
    }
  }
}

export function paymentTokenContext(row: {
  club_id: string;
  external_account_id: string;
  livemode: boolean;
}) {
  return `${row.club_id}:gocardless:${row.external_account_id}:${row.livemode}`;
}
