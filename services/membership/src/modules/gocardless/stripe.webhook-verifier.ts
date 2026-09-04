import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { getStripeConfig } from '../../config/stripe.config';
import {
  PaymentProviderName,
  ProviderWebhookEvent,
  WebhookVerifier,
} from '../finance/payment-providers/payment-provider.interface';

/**
 * Verifies and parses inbound Stripe Connect webhooks.
 *
 * One platform endpoint receives events for every connected account, each event
 * carrying the account it belongs to, so a single platform-level signing secret
 * covers all of them. Verification runs before any club is known: the signature
 * is what makes the payload trustworthy enough to read an account id out of.
 *
 * Deliberately STATELESS. This is a DI singleton shared across concurrent
 * requests, so nothing about one webhook may be held on the instance between
 * verify() and parse(); both re-derive from the raw body. constructEvent is a
 * local HMAC check, so re-running it in parse() is free and keeps the two calls
 * independent and race-free, exactly like the GoCardless verifier.
 *
 * Stripe's event shape ({ type: 'payment_intent.succeeded', data.object, account })
 * is mapped into the provider-neutral vocabulary the webhook handler already
 * speaks, so the handler needs no knowledge of Stripe. The connected account is
 * carried through on the normalised event's `links.account`, which is where
 * accountRefOf reads it, so account resolution is also stateless.
 */
@Injectable()
export class StripeWebhookVerifier implements WebhookVerifier {
  readonly name: PaymentProviderName = 'stripe';
  private readonly logger = new Logger(StripeWebhookVerifier.name);
  // Needed only for its signature helper; constructEvent is a local HMAC check,
  // so this client never makes a network call and its key is irrelevant.
  private readonly stripe = new Stripe('sk_unused_for_signature_check', {
    apiVersion: '2026-06-24.dahlia',
  });

  constructor(private readonly configService: ConfigService) {}

  private get webhookSecret(): string | undefined {
    // Read lazily, matching the GoCardless verifier, so the configured state is
    // consulted per call rather than frozen at construction.
    return getStripeConfig(this.configService).webhookSecret;
  }

  verify(rawBody: string, signature: string): boolean {
    // Fail closed, and say why. An unset secret must reject rather than appear
    // to verify, and the cause (configuration, not a forged request) should be
    // visible in the logs.
    const secret = this.webhookSecret;
    if (!secret) {
      this.logger.error(
        'STRIPE_WEBHOOK_SECRET is not configured, so no Stripe webhook can be verified. ' +
          'Inbound Stripe events are being rejected.',
      );
      return false;
    }
    if (!signature) {
      return false;
    }

    return this.constructEvent(rawBody, signature, secret) !== null;
  }

  parse(rawBody: string): ProviderWebhookEvent[] {
    // parse() has no signature header, so it cannot re-verify; it relies on the
    // controller having called verify() first and thrown on failure, the same
    // contract the GoCardless verifier's parse() follows. JSON.parse of a body
    // already proven authentic is safe.
    let event: Stripe.Event;
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch (error) {
      this.logger.error(`Failed to parse Stripe webhook body: ${(error as Error).message}`);
      return [];
    }

    const normalised = this.normalise(event);
    return normalised ? [normalised] : [];
  }

  /**
   * Stripe Connect events carry the connected account in the top-level
   * `account` field, which normalise() copies to `links.account`. Absent for
   * events on the platform's own account, which is not a club, so those return
   * null and are ignored upstream.
   */
  accountRefOf(event: ProviderWebhookEvent): string | null {
    return event.links.account ?? null;
  }

  private constructEvent(rawBody: string, signature: string, secret: string): Stripe.Event | null {
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      // StripeSignatureVerificationError for a bad signature; anything else
      // (malformed body, stale timestamp) is equally a reason not to trust it.
      this.logger.error(
        `Stripe webhook signature verification failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Map a Stripe event onto the provider-neutral shape.
   *
   * Only the event types the handler acts on are mapped; anything else returns
   * null and is dropped. resource_type/action mirror the GoCardless vocabulary
   * WebhooksService switches on, so a mandate or payment update takes the same
   * path regardless of provider. The connected account rides on links.account.
   */
  private normalise(event: Stripe.Event): ProviderWebhookEvent | null {
    const mapped = STRIPE_EVENT_MAP[event.type];
    if (!mapped) {
      this.logger.log(`Ignoring unmapped Stripe event type: ${event.type}`);
      return null;
    }

    const account = (event.account as string | undefined) ?? undefined;
    const object = event.data.object as {
      id?: string;
      last_payment_error?: {
        code?: string;
        decline_code?: string;
        message?: string;
      } | null;
    };

    const links: Record<string, string> = {};
    if (account) {
      links.account = account;
    } else if (mapped.resource_type === 'connections' && object.id) {
      // account.updated carries the connected account as BOTH the event's
      // `account` and the payload object itself; fall back to the object so the
      // event still routes if only one is present.
      links.account = object.id;
    }
    // The handler resolves the local record from this link. For payments the
    // object is the PaymentIntent, whose id we stored as provider_payment_id.
    if (mapped.resource_type === 'payments') {
      links.payment = object.id ?? '';
    }

    return {
      id: event.id,
      resource_type: mapped.resource_type,
      action: mapped.action,
      links,
      details: this.failureDetailsOf(mapped, object),
    };
  }

  /**
   * Map Stripe's last_payment_error into the GoCardless-shaped failure details
   * the handler persists and keys payer-facing copy on. Stripe's decline_code
   * vocabulary overlaps GoCardless's normalised causes (insufficient_funds and
   * friends), so the existing copy map serves both providers; the card-level
   * error code is the fallback, and Stripe's own message rides along as the
   * human-readable description.
   */
  private failureDetailsOf(
    mapped: { resource_type: string; action: string },
    object: {
      last_payment_error?: { code?: string; decline_code?: string; message?: string } | null;
    },
  ): ProviderWebhookEvent['details'] {
    if (mapped.resource_type !== 'payments' || mapped.action !== 'failed') {
      return undefined;
    }
    const error = object.last_payment_error;
    if (!error || (!error.decline_code && !error.code && !error.message)) {
      return undefined;
    }
    return {
      cause: error.decline_code ?? error.code,
      description: error.message,
    };
  }
}

/**
 * Stripe event type -> provider-neutral (resource_type, action).
 *
 * Deliberately small: the payment outcomes the handler reacts to, plus
 * account.updated, which drives connection-status sync. Mandate lifecycle for
 * Stripe is read on demand from the PaymentMethod (see
 * StripeProvider.getMandateStatus) rather than via webhooks: a detached payment
 * method emits payment_method.detached, but the durable source of truth is the
 * retrieve, so no mandate events are mapped here.
 */
const STRIPE_EVENT_MAP: Record<string, { resource_type: string; action: string }> = {
  'payment_intent.succeeded': { resource_type: 'payments', action: 'confirmed' },
  'payment_intent.payment_failed': { resource_type: 'payments', action: 'failed' },
  'payment_intent.canceled': { resource_type: 'payments', action: 'cancelled' },
  'account.updated': { resource_type: 'connections', action: 'updated' },
};
