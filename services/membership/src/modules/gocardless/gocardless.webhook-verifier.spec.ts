import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { GoCardlessWebhookVerifier } from './gocardless.webhook-verifier';
import { ProviderWebhookEvent } from '../finance/payment-providers/payment-provider.interface';

describe('GoCardlessWebhookVerifier', () => {
  const SECRET = 'whsec_test_secret';

  const configValues: Record<string, string | undefined> = {};
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  let verifier: GoCardlessWebhookVerifier;

  /** A genuine signature, computed the way GoCardless computes it. */
  const sign = (body: string, secret = SECRET) =>
    createHmac('sha256', secret).update(body).digest('hex');

  beforeEach(() => {
    jest.clearAllMocks();
    configValues.GOCARDLESS_WEBHOOK_SECRET = SECRET;
    verifier = new GoCardlessWebhookVerifier(configService);
  });

  it('is named gocardless', () => {
    expect(verifier.name).toBe('gocardless');
  });

  describe('verify', () => {
    it('accepts a correctly signed body', () => {
      const body = '{"events":[{"id":"EV1"}]}';

      expect(verifier.verify(body, sign(body))).toBe(true);
    });

    it('rejects a body signed with the wrong secret', () => {
      const body = '{"events":[]}';

      expect(verifier.verify(body, sign(body, 'wrong_secret'))).toBe(false);
    });

    it('rejects when the body has been tampered with after signing', () => {
      // The whole point of the signature: the payload cannot be trusted unless
      // it is byte-for-byte what was signed.
      const signature = sign('{"events":[{"amount":100}]}');

      expect(verifier.verify('{"events":[{"amount":9999}]}', signature)).toBe(false);
    });

    it('fails closed when the signing secret is not configured', () => {
      // Production currently has no GOCARDLESS_WEBHOOK_SECRET set. Rejecting is
      // correct; the bug being guarded against is rejecting SILENTLY, as an
      // empty-string HMAC would.
      delete configValues.GOCARDLESS_WEBHOOK_SECRET;
      const body = '{"events":[]}';

      expect(verifier.verify(body, sign(body))).toBe(false);
    });

    it('rejects an empty signature', () => {
      expect(verifier.verify('{"events":[]}', '')).toBe(false);
    });

    it('rejects a signature of a different length without throwing', () => {
      // timingSafeEqual throws on length mismatch, so a short signature must be
      // handled rather than becoming a 500.
      expect(() => verifier.verify('{"events":[]}', 'abc')).not.toThrow();
      expect(verifier.verify('{"events":[]}', 'abc')).toBe(false);
    });
  });

  describe('parse', () => {
    it('returns the events array from a valid body', () => {
      const events = [{ id: 'EV1', resource_type: 'mandates', action: 'active', links: {} }];

      expect(verifier.parse(JSON.stringify({ events }))).toEqual(events);
    });

    it('returns an empty array when the body has no events', () => {
      expect(verifier.parse('{}')).toEqual([]);
    });

    it('returns an empty array rather than throwing on malformed JSON', () => {
      expect(verifier.parse('not json at all')).toEqual([]);
    });
  });

  describe('accountRefOf', () => {
    it('reads the connected organisation from a partner event', () => {
      const event: ProviderWebhookEvent = {
        id: 'EV1',
        resource_type: 'mandates',
        action: 'active',
        links: { mandate: 'MD1', organisation: 'OR123' },
      };

      expect(verifier.accountRefOf(event)).toBe('OR123');
    });

    it('returns null for an event with no organisation link', () => {
      // Events from Swimly's own non-partner account carry no organisation, so
      // null is a normal answer, not an error.
      const event: ProviderWebhookEvent = {
        id: 'EV1',
        resource_type: 'mandates',
        action: 'active',
        links: { mandate: 'MD1' },
      };

      expect(verifier.accountRefOf(event)).toBeNull();
    });
  });
});
