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
import { GoCardlessWebhookVerifier } from './gocardless.webhook-verifier';
import { WebhooksService, GoCardlessWebhookEvent } from './webhooks.service';
import { PaymentConnectionsService } from '../finance/payment-connections/payment-connections.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('webhooks/gocardless')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly verifier: GoCardlessWebhookVerifier,
    private readonly webhooksService: WebhooksService,
    private readonly connections: PaymentConnectionsService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('webhook-signature') signature: string,
    @Body() body: { events?: GoCardlessWebhookEvent[] },
  ) {
    this.logger.log('Received GoCardless webhook');

    // Verification runs before any club is known, against the platform-level
    // signing secret, so it injects the verifier directly rather than resolving
    // a club-bound provider through the registry. Nothing below may read the
    // payload until this passes: the signature is what makes it trustworthy.
    const rawBody = request.rawBody?.toString() || JSON.stringify(body);

    if (!this.verifier.verify(rawBody, signature)) {
      this.logger.error('Invalid webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const events = this.verifier.parse(rawBody);

    for (const event of events) {
      try {
        const routed = await this.resolveRoutedClub(event);
        if (!routed.known) {
          continue;
        }
        await this.webhooksService.handleEvent(event, routed.clubId);
      } catch (error) {
        this.logger.error(`Failed to process event ${event.id}`, error);
        // Continue processing other events even if one fails
      }
    }

    return { received: true };
  }

  /**
   * Work out which club an event belongs to, from the connected account that
   * sent it.
   *
   * Three outcomes:
   * - a known connected account, so the club is named;
   * - no account named at all, which is every event from Swimly's own legacy
   *   account: it serves all clubs, so no club can be inferred and the handler
   *   falls back to the record's own club (clubId null);
   * - an account we do not recognise, which is skipped.
   */
  private async resolveRoutedClub(
    event: GoCardlessWebhookEvent,
  ): Promise<{ known: true; clubId: string | null } | { known: false }> {
    const accountRef = this.verifier.accountRefOf(event);

    if (!accountRef) {
      return { known: true, clubId: null };
    }

    const connection = await this.connections.findByExternalAccountId('gocardless', accountRef);

    if (!connection) {
      // Deliberately not an error response. GoCardless retries failures and
      // eventually disables an endpoint that keeps failing, so rejecting events
      // for an account we legitimately do not know (a half-finished connect, a
      // disconnected club) would eventually break webhooks for every club.
      this.logger.warn(
        `Webhook event ${event.id} is from unknown connected account ${accountRef}; ignoring.`,
      );
      return { known: false };
    }

    return { known: true, clubId: connection.club_id };
  }
}
