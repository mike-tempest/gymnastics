import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PaymentConnectionsService } from '../payment-connections/payment-connections.service';
import {
  PAYMENT_PROVIDER_FACTORIES,
  PaymentProvider,
  PaymentProviderFactory,
  ProviderConnection,
} from './payment-provider.interface';

/**
 * Resolves the PaymentProvider a club transacts on.
 *
 * Swimly is not the merchant of record, so resolution is not "which class do we
 * use" but "whose account are we acting on". Every resolution therefore returns
 * a provider BOUND to that club's connection.
 *
 * There is no default and no fallback. A club with no usable connection raises
 * ProviderNotConnectedException rather than quietly resolving to Swimly's own
 * credentials, which is the behaviour this refactor exists to remove.
 *
 * Runs on paths with no tenant/CLS context (the payment-collection cron,
 * inbound webhooks), so callers pass an explicit clubId. Never read the tenant
 * context here.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly logger = new Logger(PaymentProviderRegistry.name);
  private readonly factoriesByName: Map<string, PaymentProviderFactory>;

  constructor(
    private readonly connections: PaymentConnectionsService,
    @Inject(PAYMENT_PROVIDER_FACTORIES)
    factories: PaymentProviderFactory[],
  ) {
    this.factoriesByName = new Map(factories.map((factory) => [factory.name, factory]));
  }

  /**
   * The provider a club transacts on, bound to its connection.
   *
   * Deliberately uncached. This is one indexed read, the same cost as the
   * settings read it replaces, and a stale cache of payment credentials is a
   * far worse failure than a query.
   */
  async forClub(clubId: string): Promise<PaymentProvider> {
    const connection = await this.connections.requireActiveConnection(clubId);
    return this.bind(connection);
  }

  /**
   * Bind an already-resolved connection to its provider. Used by the webhook
   * path, which resolves the connection from the event's account reference
   * rather than from a club id.
   */
  bind(connection: ProviderConnection): PaymentProvider {
    const factory = this.factoriesByName.get(connection.provider);

    if (!factory) {
      this.logger.error(
        `Club ${connection.clubId} is connected to provider '${connection.provider}', ` +
          `which has no registered factory.`,
      );
      throw new ServiceUnavailableException(
        `The payment provider '${connection.provider}' is not available. Please contact support.`,
      );
    }

    // Platform-level configuration (e.g. a Stripe platform secret key) is
    // separate from whether this club has connected: a club can be perfectly
    // connected while the platform itself is misconfigured, and that is an
    // operator problem, not a club problem.
    if (!factory.isConfigured()) {
      this.logger.error(
        `Provider '${connection.provider}' is not configured at the platform level, so club ` +
          `${connection.clubId} cannot transact.`,
      );
      throw new ServiceUnavailableException(
        `Payments are temporarily unavailable. Please try again later or contact support.`,
      );
    }

    return factory.create(connection);
  }
}
