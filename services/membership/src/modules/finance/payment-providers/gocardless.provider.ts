import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
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

/**
 * Builds club-bound GoCardless providers.
 *
 * GoCardlessService is a process singleton holding ONE client built from
 * Swimly's own environment credentials. That is correct for the legacy env
 * shim (`source: 'env'`), which is precisely a club still transacting on
 * Swimly's shared account.
 *
 * It is NOT correct for a real connected account: GoCardless Partner OAuth
 * issues a bearer token per merchant, so each connected club needs its own
 * client built from its own token. That client-per-token work belongs to the
 * Partner phase, so a `source: 'connection'` GoCardless connection is rejected
 * loudly here rather than being silently billed through Swimly's account,
 * which is the exact bug this whole refactor exists to remove.
 */
@Injectable()
export class GoCardlessProviderFactory implements PaymentProviderFactory {
  readonly name: PaymentProviderName = 'gocardless';
  private readonly logger = new Logger(GoCardlessProviderFactory.name);

  constructor(private readonly goCardlessService: GoCardlessService) {}

  isConfigured(): boolean {
    return this.goCardlessService.isConfigured();
  }

  create(connection: ProviderConnection): PaymentProvider {
    if (connection.source === 'connection') {
      this.logger.error(
        `Club ${connection.clubId} has a GoCardless connection row (account ` +
          `${connection.externalAccountId}) but per-merchant GoCardless credentials are not ` +
          `wired yet. Refusing rather than billing through Swimly's own account.`,
      );
      throw new NotImplementedException(
        'Connecting your own GoCardless account is not available yet. Please contact support.',
      );
    }

    return new GoCardlessProvider(connection, this.goCardlessService);
  }
}
