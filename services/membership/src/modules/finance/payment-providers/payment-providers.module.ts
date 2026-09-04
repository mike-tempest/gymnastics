import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoCardlessModule } from '../../gocardless/gocardless.module';
import { GoCardlessWebhookVerifier } from '../../gocardless/gocardless.webhook-verifier';
import { StripeWebhookVerifier } from '../../gocardless/stripe.webhook-verifier';
import { PaymentConnectionsModule } from '../payment-connections/payment-connections.module';
import { GoCardlessProviderFactory } from './gocardless.provider';
import { StripeProviderFactory } from './stripe.provider';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PAYMENT_PROVIDER_FACTORIES, WEBHOOK_VERIFIERS } from './payment-provider.interface';

/**
 * Wires the payment-provider abstraction.
 *
 * Providers are registered as FACTORIES rather than instances: a usable
 * provider is bound to one club's connection, so there is no such thing as a
 * single injectable provider. Adding a provider means adding its factory to
 * PAYMENT_PROVIDER_FACTORIES and its verifier to WEBHOOK_VERIFIERS.
 *
 * Stripe is registered but DORMANT until STRIPE_SECRET_KEY is set: its factory
 * reports isConfigured() false, so the registry refuses to bind a club to it.
 * Registering it unconditionally keeps the wiring identical whether or not the
 * key is present, so turning Stripe on is purely a matter of setting the env.
 *
 * The dependency on GoCardlessModule is one-directional and needs no
 * forwardRef: the GoCardless webhook controller verifies signatures with the
 * verifier that lives alongside it, so nothing in that module reaches back into
 * this one.
 */
@Module({
  imports: [ConfigModule, GoCardlessModule, PaymentConnectionsModule],
  providers: [
    GoCardlessProviderFactory,
    StripeProviderFactory,
    PaymentProviderRegistry,
    {
      provide: PAYMENT_PROVIDER_FACTORIES,
      useFactory: (goCardless: GoCardlessProviderFactory, stripe: StripeProviderFactory) => [
        goCardless,
        stripe,
      ],
      inject: [GoCardlessProviderFactory, StripeProviderFactory],
    },
    {
      // Both verifiers are provided by GoCardlessModule (imported above),
      // co-located with the webhook controllers that use them.
      provide: WEBHOOK_VERIFIERS,
      useFactory: (goCardless: GoCardlessWebhookVerifier, stripe: StripeWebhookVerifier) => [
        goCardless,
        stripe,
      ],
      inject: [GoCardlessWebhookVerifier, StripeWebhookVerifier],
    },
  ],
  exports: [
    PaymentProviderRegistry,
    PaymentConnectionsModule,
    PAYMENT_PROVIDER_FACTORIES,
    WEBHOOK_VERIFIERS,
  ],
})
export class PaymentProvidersModule {}
