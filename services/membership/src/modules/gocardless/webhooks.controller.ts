import { PartnerWebhooksService } from './partner-webhooks.service';
import { ServiceUnavailableException } from '@nestjs/common';
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
    private readonly partner: PartnerWebhooksService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('webhook-signature') signature: string,
    @Body() _body: { events?: GoCardlessWebhookEvent[] },
  ) {
    this.logger.log('Received GoCardless webhook');

    // Verification runs before any club is known, against the platform-level
    // signing secret, so it injects the verifier directly rather than resolving
    // a club-bound provider through the registry. Nothing below may read the
    // payload until this passes: the signature is what makes it trustworthy.
    if (!request.rawBody) throw new BadRequestException('Raw webhook body is required.');
    const rawBody = request.rawBody.toString();

    if (!this.verifier.verify(rawBody, signature)) {
      this.logger.error('Invalid webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const events = this.verifier.parse(rawBody);

    let failed = false;
    for (const event of events) {
      try {
        const routed = await this.resolveRoutedClub(event);
        if (!routed.known) {
          continue;
        }
        await this.partner.handle(event, routed.clubId!);
      } catch (error) {
        this.logger.error(`Failed to process event ${event.id}`);
        failed = true;
        // Continue processing other events even if one fails
      }
    }

    if (failed)
      throw new ServiceUnavailableException('Some events could not be processed. Retry the batch.');
    return { received: true };
  }

  /** Route only events naming a known club organisation. */
  private async resolveRoutedClub(
    event: GoCardlessWebhookEvent,
  ): Promise<{ known: true; clubId: string | null } | { known: false }> {
    const accountRef = this.verifier.accountRefOf(event);

    if (!accountRef) {
      return { known: false };
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
