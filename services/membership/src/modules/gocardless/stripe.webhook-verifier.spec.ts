import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeWebhookVerifier } from './stripe.webhook-verifier';

/**
 * These tests need NO Stripe account. Stripe's webhook signature is a local
 * HMAC over the raw body with the endpoint secret, and the SDK exposes
 * generateTestHeaderString to produce a genuine one. So the entire verify ->
 * parse -> route path is exercised for real against self-signed events.
 */
describe('StripeWebhookVerifier', () => {
  const SECRET = 'whsec_test_secret';
  const stripe = new Stripe('sk_test_unused', { apiVersion: '2026-06-24.dahlia' });

  const configValues: Record<string, string | undefined> = {};
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  let verifier: StripeWebhookVerifier;

  /** A real Stripe signature header for this body and secret. */
  const sign = (body: string, secret = SECRET) =>
    stripe.webhooks.generateTestHeaderString({ payload: body, secret });

  const eventBody = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      account: 'acct_club1',
      data: { object: { id: 'pi_123' } },
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    configValues.STRIPE_WEBHOOK_SECRET = SECRET;
    verifier = new StripeWebhookVerifier(configService);
  });

  it('is named stripe', () => {
    expect(verifier.name).toBe('stripe');
  });

  describe('verify', () => {
    it('accepts a correctly signed body', () => {
      const body = eventBody();
      expect(verifier.verify(body, sign(body))).toBe(true);
    });

    it('rejects a body signed with the wrong secret', () => {
      const body = eventBody();
      expect(verifier.verify(body, sign(body, 'whsec_wrong'))).toBe(false);
    });

    it('rejects a tampered body', () => {
      // Sign one payload, then present a different one under the same header.
      const signature = sign(eventBody({ data: { object: { id: 'pi_123', amount: 100 } } }));
      const tampered = eventBody({ data: { object: { id: 'pi_123', amount: 999999 } } });
      expect(verifier.verify(tampered, signature)).toBe(false);
    });

    it('fails closed when the signing secret is not configured', () => {
      delete configValues.STRIPE_WEBHOOK_SECRET;
      const body = eventBody();
      // The signature is valid, but with no secret the verifier cannot and must
      // not accept it.
      expect(verifier.verify(body, sign(body))).toBe(false);
    });

    it('rejects an empty signature', () => {
      expect(verifier.verify(eventBody(), '')).toBe(false);
    });
  });

  describe('parse and accountRefOf', () => {
    it('maps a succeeded PaymentIntent to a confirmed payment event', () => {
      const events = verifier.parse(eventBody());

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: 'evt_123',
        resource_type: 'payments',
        action: 'confirmed',
        links: { payment: 'pi_123', account: 'acct_club1' },
      });
    });

    it('maps a failed PaymentIntent to a failed payment event', () => {
      const events = verifier.parse(eventBody({ type: 'payment_intent.payment_failed' }));
      expect(events[0]).toMatchObject({ resource_type: 'payments', action: 'failed' });
    });

    it('maps a canceled PaymentIntent to a cancelled payment event', () => {
      const events = verifier.parse(eventBody({ type: 'payment_intent.canceled' }));
      expect(events[0]).toMatchObject({ resource_type: 'payments', action: 'cancelled' });
    });

    it('drops an event type it does not handle', () => {
      // A charge.refunded (say) is not in the map; the handler must not see it.
      expect(verifier.parse(eventBody({ type: 'charge.refunded' }))).toEqual([]);
    });

    it('maps account.updated to a connections event carrying the account', () => {
      const events = verifier.parse(
        eventBody({ type: 'account.updated', data: { object: { id: 'acct_club1' } } }),
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        resource_type: 'connections',
        action: 'updated',
        links: { account: 'acct_club1' },
      });
    });

    it('routes account.updated from the payload object when the account field is absent', () => {
      const [event] = verifier.parse(
        eventBody({
          type: 'account.updated',
          account: undefined,
          data: { object: { id: 'acct_from_object' } },
        }),
      );

      expect(verifier.accountRefOf(event)).toBe('acct_from_object');
    });

    it('maps last_payment_error onto failure details for a failed payment', () => {
      const [event] = verifier.parse(
        eventBody({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_123',
              last_payment_error: {
                code: 'card_declined',
                decline_code: 'insufficient_funds',
                message: 'Your card has insufficient funds.',
              },
            },
          },
        }),
      );

      // decline_code wins: it is the value that overlaps GoCardless's
      // normalised causes, so the existing payer-facing copy map serves both.
      expect(event.details).toEqual({
        cause: 'insufficient_funds',
        description: 'Your card has insufficient funds.',
      });
    });

    it('falls back to the error code when there is no decline code', () => {
      const [event] = verifier.parse(
        eventBody({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_123',
              last_payment_error: { code: 'expired_card', message: 'Your card has expired.' },
            },
          },
        }),
      );

      expect(event.details).toEqual({
        cause: 'expired_card',
        description: 'Your card has expired.',
      });
    });

    it('omits details when a failed payment carries no error', () => {
      const [event] = verifier.parse(eventBody({ type: 'payment_intent.payment_failed' }));
      expect(event.details).toBeUndefined();
    });

    it('omits details on non-failure payment events', () => {
      const [event] = verifier.parse(eventBody());
      expect(event.details).toBeUndefined();
    });

    it('reads the connected account from links', () => {
      const [event] = verifier.parse(eventBody());
      expect(verifier.accountRefOf(event)).toBe('acct_club1');
    });

    it('returns null for a platform event with no connected account', () => {
      // A Stripe event without `account` is on the platform's own account, not a
      // club's. accountRefOf returns null so the controller skips it.
      const [event] = verifier.parse(eventBody({ account: undefined }));
      expect(verifier.accountRefOf(event)).toBeNull();
    });

    it('returns none rather than throwing on a malformed body', () => {
      expect(verifier.parse('not json')).toEqual([]);
    });
  });

  describe('statelessness', () => {
    it('does not leak the account between interleaved events', () => {
      // The verifier is a DI singleton. accountRefOf must read its argument, not
      // shared instance state, or concurrent webhooks would cross accounts.
      const [a] = verifier.parse(eventBody({ id: 'evt_a', account: 'acct_A' }));
      const [b] = verifier.parse(eventBody({ id: 'evt_b', account: 'acct_B' }));

      // Query them out of order; each must still report its own account.
      expect(verifier.accountRefOf(b)).toBe('acct_B');
      expect(verifier.accountRefOf(a)).toBe('acct_A');
    });
  });
});
