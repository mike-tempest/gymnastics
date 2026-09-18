import {
  Controller,
  Post,
  Req,
  RawBodyRequest,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Resend } from 'resend';
import { Public } from '../auth/decorators/public.decorator';
import { NotificationDeliveriesService } from './notification-deliveries.service';

@Controller('notification-deliveries/resend-events')
export class ResendEventsController {
  private readonly verifier = new Resend('webhook-verification-only');
  constructor(
    private readonly config: ConfigService,
    private readonly deliveries: NotificationDeliveriesService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');
    if (!secret || !req.rawBody)
      throw new UnauthorizedException('Webhook verification unavailable');
    let event: { type: string; data: { email_id?: string } };
    try {
      event = this.verifier.webhooks.verify({
        payload: req.rawBody.toString('utf8'),
        webhookSecret: secret,
        headers: {
          id: String(req.headers['svix-id'] || ''),
          timestamp: String(req.headers['svix-timestamp'] || ''),
          signature: String(req.headers['svix-signature'] || ''),
        },
      }) as typeof event;
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const statuses = {
      'email.delivered': 'delivered',
      'email.bounced': 'failed',
      'email.complained': 'failed',
      'email.failed': 'failed',
      'email.suppressed': 'suppressed',
    } as const;
    const status = statuses[event.type as keyof typeof statuses];
    if (status && event.data?.email_id)
      await this.deliveries.recordProviderEvent(event.data.email_id, status);
    return { received: true };
  }
}
