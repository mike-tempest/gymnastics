import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookVerifier } from './stripe.webhook-verifier';
import { WebhooksService, GoCardlessWebhookEvent } from './webhooks.service';
import { PaymentConnectionsService } from '../finance/payment-connections/payment-connections.service';
import { StripeConnectService } from '../finance/payment-connections/stripe-connect.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Inbound Stripe Connect webhooks.
 *
 * Mirrors the GoCardless webhook controller, with one deliberate difference:
 * Stripe has no legacy shared account. Swimly never processed Stripe before
 * connected accounts, so a Stripe event that names no connected account is a
 * platform-level event that belongs to no club, and is ignored rather than
 * passed through with a null club. Every club-relevant Stripe event carries the
 * connected account it happened on.
 */
@Controller('webhooks/stripe')
export class StripeWebhooksController {
  private readonly logger = new Logger(StripeWebhooksController.name);

  constructor(
    private readonly verifier: StripeWebhookVerifier,
    private readonly webhooksService: WebhooksService,
    private readonly connections: PaymentConnectionsService,
    private readonly stripeConnect: StripeConnectService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Body() body: unknown,
  ) {
    this.logger.log('Received Stripe webhook');

    // Verify against the platform-level signing secret before reading anything.
    // Stripe's signature covers the exact raw bytes, so the raw body is required
    // here; a re-serialised body would not verify.
    const rawBody = request.rawBody?.toString() || JSON.stringify(body);

    if (!this.verifier.verify(rawBody, signature)) {
      this.logger.error('Invalid Stripe webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const events = this.verifier.parse(rawBody);

    for (const event of events) {
      try {
        // account.updated drives connection-status sync, not billing records:
        // the sync service resolves (and tolerates) the account itself, so it
        // bypasses the club routing below. Same logic as the admin /sync
        // endpoint, so the two can never drift.
        if (event.resource_type === 'connections') {
          const accountRef = this.verifier.accountRefOf(event);
          if (accountRef) {
            await this.stripeConnect.syncByAccountId(accountRef);
          }
          continue;
        }

        const clubId = await this.resolveClub(event);
        if (clubId === undefined) {
          continue;
        }
        await this.webhooksService.handleEvent(event, clubId, 'stripe');
      } catch (error) {
        this.logger.error(`Failed to process Stripe event ${event.id}`, error);
        // Keep processing the rest of the batch even if one event fails.
      }
    }

    return { received: true };
  }

  /**
   * The club a Stripe event belongs to.
   *
   * Returns the club id for a known connected account, or `undefined` to signal
   * "skip this event": either it names no account (a platform-level event, not a
   * club's) or names one we do not recognise (a half-finished or removed
   * connection). Both are answered 200 upstream, because Stripe disables an
   * endpoint that keeps returning errors, and neither is an error we can fix by
   * failing the delivery.
   *
   * Note there is no null-club path here as there is for GoCardless: Stripe has
   * no legacy shared account, so an unrouted Stripe event is never a real club's.
   */
  private async resolveClub(event: GoCardlessWebhookEvent): Promise<string | undefined> {
    const accountRef = this.verifier.accountRefOf(event);

    if (!accountRef) {
      this.logger.log(`Stripe event ${event.id} has no connected account; ignoring.`);
      return undefined;
    }

    const connection = await this.connections.findByExternalAccountId('stripe', accountRef);

    if (!connection) {
      this.logger.warn(
        `Stripe event ${event.id} is from unknown connected account ${accountRef}; ignoring.`,
      );
      return undefined;
    }

    return connection.club_id;
  }
}
