import { ConfigService } from '@nestjs/config';

/**
 * Stripe Connect platform configuration.
 *
 * There is no per-club secret here on purpose: Stripe Connect direct charges
 * authenticate with the PLATFORM secret key plus the connected account id (a
 * `Stripe-Account` header), so a club's own credentials are never stored. The
 * webhook secret is likewise platform-level: one endpoint receives events for
 * every connected account, each carrying its own `account` field.
 */
export const getStripeConfig = (configService: ConfigService) => ({
  secretKey: configService.get<string>('STRIPE_SECRET_KEY'),
  webhookSecret: configService.get<string>('STRIPE_WEBHOOK_SECRET'),
});

export type StripeConfig = ReturnType<typeof getStripeConfig>;
