import { ConfigService } from '@nestjs/config';
import { PaymentTokenCipher } from '../payment-connections/payment-token-cipher';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoCardlessService } from '../../gocardless/gocardless.service';
import {
  ChargeRecurringParams,
  ChargeRecurringResult,
  CompleteMandateSetupParams,
  CompleteMandateSetupResult,
  PaymentProvider,
  PaymentProviderFactory,
  PaymentProviderName,
  ProviderConnection,
  ProviderMandateStatus,
  StartMandateSetupParams,
  StartMandateSetupResult,
} from './payment-provider.interface';

/**
 * GoCardless implementation of the club-bound PaymentProvider contract.
 *
 * Every method is a thin adapter over GoCardlessService, delegating with
 * identical semantics. No logic lives here: this is the seam that lets the
 * finance services talk to a provider abstraction.
 *
 * Created only by GoCardlessProviderFactory, never injected: an instance is
 * meaningless without the connection telling it whose account to act on.
 */
export class GoCardlessProvider implements PaymentProvider {
  constructor(
    readonly connection: ProviderConnection,
    private readonly goCardlessService: GoCardlessService,
  ) {}

  async startMandateSetup(params: StartMandateSetupParams): Promise<StartMandateSetupResult> {
    const flow = await this.goCardlessService.createRedirectFlow({
      sessionToken: params.sessionToken,
      successRedirectUrl: params.successRedirectUrl,
      description: params.description,
      scheme: params.scheme,
    });
    // GoCardless always returns id and redirect_url for a created flow; the SDK
    // types them as optional, so coalesce to satisfy the contract.
    return {
      flowId: flow.id ?? '',
      redirectUrl: flow.redirect_url ?? '',
    };
  }

  async completeMandateSetup(
    params: CompleteMandateSetupParams,
  ): Promise<CompleteMandateSetupResult> {
    const completed = await this.goCardlessService.completeRedirectFlow(
      params.flowId,
      params.sessionToken,
    );
    // Preserve the existing nullish-coalescing-to-empty-string semantics the
    // caller relied on when reading these links directly.
    return {
      providerMandateId: completed.links?.mandate ?? '',
      providerCustomerId: completed.links?.customer ?? '',
    };
  }

  async getMandateStatus(providerMandateId: string): Promise<ProviderMandateStatus> {
    const mandate = await this.goCardlessService.getMandate(providerMandateId);
    // The SDK types status as optional. A missing status coalesces to '', which
    // falls through MandatesService's status switch to its default (no change),
    // exactly as an undefined status did before this abstraction.
    return mandate.status ?? '';
  }

  async cancelMandate(providerMandateId: string): Promise<void> {
    await this.goCardlessService.cancelMandate(providerMandateId);
  }

  async chargeRecurring(params: ChargeRecurringParams): Promise<ChargeRecurringResult> {
    const payment = await this.goCardlessService.createPayment({
      amount: params.amount,
      currency: params.currency,
      // GoCardless charges the mandate directly, so providerCustomerId is not
      // needed here. It exists on the params for Stripe, which has no
      // chargeable mandate and must name the customer.
      mandateId: params.providerMandateId,
      description: params.description,
      metadata: params.metadata,
      idempotencyKey: params.idempotencyKey,
    });
    // GoCardless always returns an id for a created payment; the SDK merely types
    // it as optional, so coalesce to satisfy the contract.
    return { providerPaymentId: payment.id ?? '' };
  }
}

/** Builds a fresh client for the connected club; no process-wide credential fallback. */
@Injectable()
export class GoCardlessProviderFactory implements PaymentProviderFactory {
  readonly name: PaymentProviderName = 'gocardless';
  constructor(private readonly config: ConfigService) {}
  isConfigured(): boolean {
    return new PaymentTokenCipher(this.config).isConfigured();
  }
  create(connection: ProviderConnection): PaymentProvider {
    const environment = this.config.get<string>('GOCARDLESS_ENVIRONMENT', 'sandbox');
    if (
      !['sandbox', 'live'].includes(environment) ||
      connection.source !== 'connection' ||
      !connection.accessToken ||
      connection.livemode !==
        (this.config.get<string>('GOCARDLESS_ENVIRONMENT', 'sandbox') === 'live')
    ) {
      throw new ServiceUnavailableException(
        'GoCardless is not connected in this payment environment.',
      );
    }
    const service = new GoCardlessService(
      new ConfigService({
        GOCARDLESS_ACCESS_TOKEN: connection.accessToken,
        GOCARDLESS_ENVIRONMENT: connection.livemode ? 'live' : 'sandbox',
      }),
    );
    return new GoCardlessProvider(connection, service);
  }
}
