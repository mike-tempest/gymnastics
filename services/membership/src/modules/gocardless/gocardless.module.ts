import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoCardlessService } from './gocardless.service';
import { GoCardlessWebhookVerifier } from './gocardless.webhook-verifier';
import { StripeWebhookVerifier } from './stripe.webhook-verifier';
import { WebhooksController } from './webhooks.controller';
import { StripeWebhooksController } from './stripe-webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { DirectDebitMandate } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { Payment } from '../finance/payments/entities/payment.entity';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { InvoiceItem } from '../finance/invoices/entities/invoice-item.entity';
import { MandatesRepository } from '../finance/mandates/mandates.repository';
import { PaymentsRepository } from '../finance/payments/payments.repository';
import { InvoicesRepository } from '../finance/invoices/invoices.repository';
import { EmailModule } from '../email/email.module';
import { FamiliesModule } from '../families/families.module';
import { PaymentConnectionsModule } from '../finance/payment-connections/payment-connections.module';

/**
 * The webhook ingress for both payment providers, plus the GoCardless API
 * client.
 *
 * Despite the name (kept to avoid churn), this module owns the `/webhooks/*`
 * endpoints and the WebhooksService that processes their events. Both providers'
 * webhook VERIFIERS live here rather than in PaymentProvidersModule, because the
 * controllers depend on them and PaymentProvidersModule already imports this
 * module. Housing them here keeps that dependency one-directional
 * (PaymentProvidersModule -> GoCardlessModule) and preserves the removal of the
 * forwardRef cycle these two modules once needed. Verification runs before any
 * club is known, so a verifier needs no club-bound provider from that module.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([DirectDebitMandate, Payment, Invoice, InvoiceItem]),
    EmailModule,
    FamiliesModule,
    // The webhook controller resolves which club a connected account belongs
    // to. PaymentConnectionsModule depends on nothing but the database, so this
    // stays one-directional and reintroduces no cycle.
    PaymentConnectionsModule,
  ],
  controllers: [WebhooksController, StripeWebhooksController],
  providers: [
    GoCardlessService,
    GoCardlessWebhookVerifier,
    StripeWebhookVerifier,
    WebhooksService,
    MandatesRepository,
    PaymentsRepository,
    InvoicesRepository,
  ],
  exports: [GoCardlessService, GoCardlessWebhookVerifier, StripeWebhookVerifier],
})
export class GoCardlessModule {}
