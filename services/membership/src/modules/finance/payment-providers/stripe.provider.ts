import { BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { getStripeConfig } from '../../../config/stripe.config';
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
 * Bank-debit payment method types per scheme, always with card as a companion.
 *
 * The scheme arrives from the club's region config (the same value the
 * GoCardless flow pins its redirect to), so a UK club offers Bacs, an
 * Australian club BECS, and so on. Card rides along in every case: it is the
 * universal fallback, and for a payer whose bank cannot do the local debit
 * scheme it is the only way to finish setup at all.
 */
const SCHEME_PAYMENT_METHOD_TYPES: Record<string, string[]> = {
  bacs: ['bacs_debit', 'card'],
  becs: ['au_becs_debit', 'card'],
  ach: ['us_bank_account', 'card'],
  pad: ['acss_debit', 'card'],
  sepa_core: ['sepa_debit', 'card'],
};

/** Payment method types when no scheme is known: card works everywhere. */
const CARD_ONLY = ['card'];

/**
 * Stripe Connect implementation of the club-bound PaymentProvider contract.
 *
 * Every call is made with the PLATFORM secret key plus the club's connected
 * account id, passed per request as `stripeAccount` (a direct charge on the
 * connected account). No per-club secret is held: the account id is not a
 * secret, which is the whole reason Phase 1 needs no encryption for Stripe.
 *
 * The provider-neutral vocabulary maps onto Stripe as:
 * - flowId             -> Checkout Session id (`cs_…`) in setup mode
 * - providerMandateId  -> PaymentMethod id (`pm_…`), the durable chargeable handle
 * - providerCustomerId -> Customer id (`cus_…`)
 * GoCardless charges a mandate directly; Stripe has no chargeable "mandate", so
 * an off-session PaymentIntent names both the customer and the payment method.
 *
 * Mandate setup uses STRIPE CHECKOUT in setup mode deliberately: it is a hosted
 * redirect (start -> hosted page -> success redirect -> complete), which is
 * exactly the shape of the existing GoCardless redirect flow, so the same
 * MandatesService flow and the same frontend drive both providers.
 *
 * Created only by StripeProviderFactory, never injected: an instance is
 * meaningless without the connection naming whose account to charge.
 */
export class StripeProvider implements PaymentProvider {
  private readonly logger = new Logger(StripeProvider.name);

  constructor(
    readonly connection: ProviderConnection,
    private readonly stripe: Stripe,
  ) {}

  async startMandateSetup(params: StartMandateSetupParams): Promise<StartMandateSetupResult> {
    const stripeAccount = this.connection.externalAccountId;

    // Customers live on the CONNECTED account (the club's own), never the
    // platform. Reuse the customer a previous mandate recorded for this payer
    // so one family does not accumulate duplicate Stripe customers.
    let customerId = params.existingProviderCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create(
        { description: params.description },
        { stripeAccount },
      );
      customerId = customer.id;
    }

    // Stripe substitutes the literal {CHECKOUT_SESSION_ID} placeholder when
    // redirecting, which is how the completion call learns the flow id. This
    // mirrors GoCardless appending redirect_flow_id to its success URL: the
    // frontend reads one query parameter either way.
    const successUrl =
      params.successRedirectUrl +
      (params.successRedirectUrl.includes('?') ? '&' : '?') +
      'session_id={CHECKOUT_SESSION_ID}';

    const sessionParams = (paymentMethodTypes: string[]): Stripe.Checkout.SessionCreateParams => ({
      mode: 'setup',
      customer: customerId,
      payment_method_types:
        paymentMethodTypes as Stripe.Checkout.SessionCreateParams['payment_method_types'],
      success_url: successUrl,
      // No session id on cancel: the frontend distinguishes success from
      // abandonment by the presence of the session_id parameter.
      cancel_url: params.successRedirectUrl,
      // Ties completion back to the caller that started the flow, mirroring the
      // GoCardless session_token round-trip.
      metadata: { session_token: params.sessionToken },
    });

    const preferredTypes = SCHEME_PAYMENT_METHOD_TYPES[params.scheme ?? ''] ?? CARD_ONLY;

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create(sessionParams(preferredTypes), {
        stripeAccount,
      });
    } catch (error) {
      // A connected account may not have the bank-debit capability active yet
      // (capabilities are activated per account, often after extra review).
      // Card is universal, so retry once with card only rather than failing the
      // payer's setup because of the club's pending capability.
      if (this.isInvalidRequest(error) && preferredTypes !== CARD_ONLY) {
        this.logger.warn(
          `Stripe rejected payment_method_types [${preferredTypes.join(', ')}] on connected ` +
            `account ${stripeAccount} (${(error as Error).message}). Retrying with card only. ` +
            `The club likely needs to activate the bank-debit capability in Stripe.`,
        );
        session = await this.stripe.checkout.sessions.create(sessionParams(CARD_ONLY), {
          stripeAccount,
        });
      } else {
        throw error;
      }
    }

    this.logger.log(
      `Created Checkout setup session ${session.id} on connected account ${stripeAccount}`,
    );

    return {
      flowId: session.id,
      // Stripe always returns a URL for a newly created hosted session; the SDK
      // merely types it as nullable.
      redirectUrl: session.url ?? '',
    };
  }

  async completeMandateSetup(
    params: CompleteMandateSetupParams,
  ): Promise<CompleteMandateSetupResult> {
    const stripeAccount = this.connection.externalAccountId;

    const session = await this.stripe.checkout.sessions.retrieve(
      params.flowId,
      { expand: ['setup_intent.payment_method'] },
      { stripeAccount },
    );

    // The session token round-trip is what stops one caller completing another
    // caller's flow: the token was written into the session's metadata at start
    // and must be presented again to claim the result, exactly as GoCardless
    // enforces for its redirect flows.
    if (session.metadata?.session_token !== params.sessionToken) {
      throw new BadRequestException('Mandate setup session does not match this request.');
    }

    const setupIntent = session.setup_intent as Stripe.SetupIntent | null;

    if (session.status !== 'complete' || setupIntent?.status !== 'succeeded') {
      throw new BadRequestException('Mandate setup has not been completed by the payer.');
    }

    const paymentMethod = setupIntent.payment_method;
    const providerMandateId =
      typeof paymentMethod === 'string' ? paymentMethod : (paymentMethod?.id ?? '');
    const providerCustomerId =
      typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? '');

    if (!providerMandateId) {
      // A succeeded SetupIntent always carries its payment method; reaching
      // here means Stripe's response shape changed and charging would be
      // impossible, so fail loudly rather than persist an unusable mandate.
      throw new BadRequestException('Mandate setup did not produce a payment method.');
    }

    this.logger.log(
      `Completed Checkout setup session ${params.flowId}: payment method ${providerMandateId} ` +
        `for customer ${providerCustomerId} on connected account ${stripeAccount}`,
    );

    return { providerMandateId, providerCustomerId };
  }

  async getMandateStatus(providerMandateId: string): Promise<ProviderMandateStatus> {
    // The status vocabulary mirrors GoCardless because that is what
    // MandatesService's mapping switch consumes: 'active' -> ACTIVE,
    // 'cancelled' -> CANCELLED. A Stripe PaymentMethod has no richer lifecycle
    // worth surfacing: attached to a customer it is chargeable, detached or
    // deleted it is not.
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(
        providerMandateId,
        {},
        { stripeAccount: this.connection.externalAccountId },
      );
      return paymentMethod.customer ? 'active' : 'cancelled';
    } catch (error) {
      if (this.isMissingResource(error)) {
        return 'cancelled';
      }
      throw error;
    }
  }

  async cancelMandate(providerMandateId: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.detach(
        providerMandateId,
        {},
        { stripeAccount: this.connection.externalAccountId },
      );
    } catch (error) {
      // Detaching an already-detached or missing payment method raises an
      // invalid-request error. The end state the caller asked for (this method
      // can no longer be charged) already holds, so tolerate it.
      if (this.isInvalidRequest(error) || this.isMissingResource(error)) {
        this.logger.log(
          `Payment method ${providerMandateId} was already detached or gone; treating cancel ` +
            `as a no-op.`,
        );
        return;
      }
      throw error;
    }
  }

  async chargeRecurring(params: ChargeRecurringParams): Promise<ChargeRecurringResult> {
    if (!params.providerCustomerId) {
      // Stripe cannot charge a bare payment method off-session; it needs the
      // customer it is attached to. GoCardless does not, which is why the field
      // is optional on the shared contract but required here.
      throw new NotImplementedException(
        'A Stripe charge requires the customer the payment method is attached to.',
      );
    }

    this.logger.log(
      `Charging ${params.currency} ${params.amount} on connected account ` +
        `${this.connection.externalAccountId}`,
    );

    const intent = await this.stripe.paymentIntents.create(
      {
        // Stripe amounts are in the minor unit (cents/pence); the contract
        // carries major units, matching GoCardless, so convert here. Round to
        // avoid a floating-point remainder becoming a sub-penny error.
        amount: Math.round(params.amount * 100),
        currency: params.currency.toLowerCase(),
        customer: params.providerCustomerId,
        payment_method: params.providerMandateId,
        // Off-session: the payer is not present, so reuse the mandate captured
        // at setup and confirm immediately.
        off_session: true,
        confirm: true,
        description: params.description,
        metadata: params.metadata,
      },
      {
        // The direct-charge header: the charge lands on the club's account, not
        // Swimly's. Swimly is not the merchant of record.
        stripeAccount: this.connection.externalAccountId,
        // Makes a retry of the same logical charge a no-op at Stripe rather than
        // taking the money twice. See ChargeRecurringParams.idempotencyKey.
        idempotencyKey: params.idempotencyKey,
      },
    );

    return { providerPaymentId: intent.id };
  }

  /** Stripe invalid-request errors, matched structurally so mocks can raise them. */
  private isInvalidRequest(error: unknown): boolean {
    return (error as { type?: string })?.type === 'StripeInvalidRequestError';
  }

  /** Stripe's "no such object" error code. */
  private isMissingResource(error: unknown): boolean {
    return (error as { code?: string })?.code === 'resource_missing';
  }
}

/**
 * Builds club-bound Stripe providers.
 *
 * Holds ONE Stripe SDK client, built from the platform secret key. That single
 * client serves every connected account: the account is selected per call via
 * `stripeAccount`, not by constructing a new client, so binding a provider to a
 * connection is free.
 *
 * Dormant until STRIPE_SECRET_KEY is set: isConfigured() returns false and the
 * registry refuses to bind, so an absent key can never silently route a club to
 * an unconfigured Stripe rather than erroring.
 */
@Injectable()
export class StripeProviderFactory implements PaymentProviderFactory {
  readonly name: PaymentProviderName = 'stripe';
  private readonly client: Stripe | null;

  constructor(configService: ConfigService) {
    const { secretKey } = getStripeConfig(configService);
    // Pin the API version this SDK is built against, so a Stripe-side default
    // bump cannot change behaviour under us. Null client when unconfigured keeps
    // the provider dormant.
    this.client = secretKey ? new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  create(connection: ProviderConnection): PaymentProvider {
    if (!this.client) {
      // The registry checks isConfigured() before calling create(), so reaching
      // here is a programming error rather than a runtime configuration one.
      throw new Error('StripeProviderFactory.create called while Stripe is not configured');
    }
    return new StripeProvider(connection, this.client);
  }
}
