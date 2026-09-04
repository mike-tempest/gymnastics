import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  PaymentProviderName,
  ProviderWebhookEvent,
  WebhookVerifier,
} from '../finance/payment-providers/payment-provider.interface';

/**
 * Verifies and parses inbound GoCardless webhooks.
 *
 * Separate from the club-bound provider because this runs before any club is
 * known: the signature is what makes the payload trustworthy enough to read an
 * account id out of in the first place. The signing secret is
 * platform/partner-level and lives in the environment, so one secret covers
 * every connected club.
 */
@Injectable()
export class GoCardlessWebhookVerifier implements WebhookVerifier {
  readonly name: PaymentProviderName = 'gocardless';
  private readonly logger = new Logger(GoCardlessWebhookVerifier.name);

  constructor(private readonly configService: ConfigService) {}

  verify(rawBody: string, signature: string): boolean {
    const secret = this.configService.get<string>('GOCARDLESS_WEBHOOK_SECRET');

    // Fail closed, and say so. Previously an unset secret silently HMACed with
    // an empty string, so every webhook failed verification with no indication
    // that the cause was configuration rather than a forged request.
    if (!secret) {
      this.logger.error(
        'GOCARDLESS_WEBHOOK_SECRET is not configured, so no webhook can be verified. ' +
          'Inbound GoCardless events are being rejected.',
      );
      return false;
    }

    if (!signature) {
      return false;
    }

    try {
      const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
      const computedBuffer = Buffer.from(computed, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      // timingSafeEqual throws on length mismatch, so compare lengths first.
      // A differing length already means the signature is wrong.
      if (computedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return timingSafeEqual(computedBuffer, signatureBuffer);
    } catch (error) {
      this.logger.error('Failed to verify webhook signature', error);
      return false;
    }
  }

  parse(rawBody: string): ProviderWebhookEvent[] {
    try {
      const body = JSON.parse(rawBody) as { events?: ProviderWebhookEvent[] };
      return body?.events ?? [];
    } catch (error) {
      this.logger.error('Failed to parse webhook body', error);
      return [];
    }
  }

  /**
   * GoCardless Partner webhooks name the connected merchant in
   * `links.organisation`. Events from Swimly's own (non-partner) account carry
   * no organisation link, which is why null is a normal answer here and the
   * caller falls back to the legacy env connection.
   */
  accountRefOf(event: ProviderWebhookEvent): string | null {
    return event.links?.organisation ?? null;
  }
}
