import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubPaymentConnection } from './entities/club-payment-connection.entity';
import { PaymentConnectionsService } from './payment-connections.service';
import { StripeConnectService } from './stripe-connect.service';
import { PaymentConnectionsController } from './payment-connections.controller';

/**
 * Owns a club's connection to its own payment provider account.
 *
 * Deliberately depends on nothing but the database, config, and the global
 * clubs/tenancy modules: it is resolved from webhook and cron paths that have
 * no request context, and it must stay importable without dragging in the
 * provider implementations (which depend on it, not the other way round).
 *
 * StripeConnectService lives here rather than in PaymentProvidersModule for
 * the same reason: the webhook ingress (GoCardlessModule) needs the
 * account.updated sync, and it already imports this module, so housing the
 * sync here keeps that dependency one-directional.
 */
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ClubPaymentConnection])],
  controllers: [PaymentConnectionsController],
  providers: [PaymentConnectionsService, StripeConnectService],
  exports: [PaymentConnectionsService, StripeConnectService],
})
export class PaymentConnectionsModule {}
