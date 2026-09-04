/**
 * Provider-neutral payment abstraction.
 *
 * Swimly is not the merchant of record. Every club transacts on its OWN
 * provider account, so a provider instance is only meaningful once bound to a
 * specific club's connection. That shapes this file into three contracts:
 *
 * - `PaymentProvider` is CLUB-BOUND. It is constructed per resolution by a
 *   factory, already carrying the club's connection, so its methods stay free
 *   of club or credential arguments.
 * - `PaymentProviderFactory` is a DI singleton per provider. It turns a
 *   connection into a bound `PaymentProvider`.
 * - `WebhookVerifier` is a DI singleton per provider. Webhook verification runs
 *   BEFORE the club is known (the signature is what makes the payload
 *   trustworthy at all), so it cannot live on a club-bound provider. It
 *   verifies against a platform/partner-level secret from the environment, then
 *   reports which connected account an event belongs to so the caller can
 *   resolve the club.
 */

/**
 * Name of a wired payment provider.
 */
export type PaymentProviderName = 'gocardless' | 'stripe';

/**
 * DI token for the array of registered PaymentProviderFactory implementations.
 * Adding a provider is one entry in the module's factory array.
 */
export const PAYMENT_PROVIDER_FACTORIES = Symbol('PAYMENT_PROVIDER_FACTORIES');

/**
 * DI token for the array of registered WebhookVerifier implementations.
 */
export const WEBHOOK_VERIFIERS = Symbol('WEBHOOK_VERIFIERS');

/**
 * Where a resolved connection came from.
 *
 * `connection` is the normal case: a row in club_payment_connections, created
 * when the club connected its own provider account.
 *
 * `env` is a deliberate, temporary shim that synthesises a connection from
 * Swimly's own environment-configured GoCardless credentials. It is OFF by
 * default and only produced when LEGACY_GOCARDLESS_ENV_FALLBACK='true', which
 * exists solely for local demo environments that seed GoCardless mandates
 * directly; Stripe Connect is the payment setup path for every club. The shim
 * is removed entirely when GoCardless Partner OAuth lands.
 */
export type ProviderConnectionSource = 'connection' | 'env';

/**
 * A club's connection to its own provider account: everything a bound provider
 * needs in order to act on that club's behalf.
 */
export interface ProviderConnection {
  clubId: string;
  provider: PaymentProviderName;
  /**
   * The provider-side account identifier: a Stripe `acct_…` or a GoCardless
   * organisation id. Not a secret, and safe to log.
   */
  externalAccountId: string;
  /**
   * Whether this connection transacts real money. A test-mode account on a
   * live club takes no money while looking like it succeeded, so this is
   * carried explicitly rather than assumed.
   */
  livemode: boolean;
  source: ProviderConnectionSource;
  /**
   * Bearer token for providers whose API is authenticated per merchant
   * (GoCardless Partner OAuth). Stripe Connect does not use this: the platform
   * key plus the connected account id is the whole story, which is why nothing
   * populates this yet.
   */
  accessToken?: string;
}

/**
 * Parameters to begin provider-hosted mandate setup. Models a redirect flow:
 * the provider returns a hosted URL the payer is sent to.
 */
export interface StartMandateSetupParams {
  /** Opaque session token tying the start and completion of the flow together. */
  sessionToken: string;
  /** URL the provider redirects the payer back to once they have authorised. */
  successRedirectUrl: string;
  /** Optional human-readable description shown to the payer. */
  description?: string;
  /** Bank-debit scheme for the club's country (bacs, ach, pad, becs, sepa_core). */
  scheme?: string;
  /**
   * Provider-side customer id from a previous mandate for the same payer, so a
   * provider that models payers as durable customers (Stripe) can reuse the
   * existing customer instead of minting a duplicate. GoCardless hosts customer
   * creation inside its redirect flow and ignores this.
   */
  existingProviderCustomerId?: string;
}

/**
 * Result of starting mandate setup: the hosted flow the payer must visit.
 */
export interface StartMandateSetupResult {
  /** Provider-side identifier for the in-progress setup flow. */
  flowId: string;
  /** Hosted URL the payer is redirected to in order to authorise the mandate. */
  redirectUrl: string;
}

/**
 * Parameters to complete a previously started mandate setup flow.
 */
export interface CompleteMandateSetupParams {
  /** Identifier returned from startMandateSetup. */
  flowId: string;
  /** The same session token used when the flow was started. */
  sessionToken: string;
}

/**
 * Result of completing mandate setup: the durable provider identifiers we
 * persist against the mandate.
 */
export interface CompleteMandateSetupResult {
  /** Provider-side mandate identifier (e.g. GoCardless mandate id). */
  providerMandateId: string;
  /** Provider-side customer identifier, if the provider exposes one. */
  providerCustomerId?: string;
}

/**
 * Parameters to charge a recurring payment against an existing mandate.
 */
export interface ChargeRecurringParams {
  /** Amount in major currency units (e.g. pounds), matching existing usage. */
  amount: number;
  /** ISO 4217 currency code the payment is denominated in. */
  currency: string;
  /** Provider-side mandate identifier to charge against. */
  providerMandateId: string;
  /**
   * Provider-side customer identifier. GoCardless charges a mandate directly
   * and ignores this; Stripe has no chargeable "mandate" and needs both the
   * customer and the payment method to raise an off-session PaymentIntent.
   */
  providerCustomerId?: string;
  /**
   * Caller-supplied key making a retry of the SAME logical charge a no-op at
   * the provider.
   *
   * The charge is taken before the local payment row is written, so a crash in
   * between leaves money taken with no record of it and a retry would charge
   * the payer twice. Key this on something stable for the logical payment (the
   * invoice and its billing period), never a timestamp or a random value.
   */
  idempotencyKey?: string;
  /** Optional description recorded with the payment. */
  description?: string;
  /** Optional provider metadata recorded with the payment. */
  metadata?: Record<string, string>;
}

/**
 * Result of charging a recurring payment.
 */
export interface ChargeRecurringResult {
  /** Provider-side payment identifier for the created charge. */
  providerPaymentId: string;
}

/**
 * Provider-neutral status of a mandate, mapped from the provider's own status
 * vocabulary. Values mirror the strings GoCardless returns so the existing
 * status-mapping logic in MandatesService is unchanged.
 */
export type ProviderMandateStatus = string;

/**
 * A single inbound webhook event, normalised to the shape the webhook handler
 * already consumes. Each provider's verifier maps its own payload into this
 * vocabulary.
 */
export interface ProviderWebhookEvent {
  id: string;
  resource_type: string;
  action: string;
  links: Record<string, string>;
  /**
   * Failure details in the GoCardless-shaped vocabulary WebhooksService
   * consumes. `cause` is the normalised machine-readable value (e.g.
   * insufficient_funds); `description` is the provider's human sentence. Each
   * verifier maps its provider's failure shape into this (Stripe maps
   * last_payment_error's decline_code/message).
   */
  details?: {
    cause?: string;
    description?: string;
  };
}

/**
 * A payment provider already bound to one club's connection.
 *
 * Instances come from a PaymentProviderFactory and are never injected directly:
 * an unbound provider has no account to act on and would fall back to Swimly's
 * own credentials, which is exactly the merchant-of-record behaviour being
 * removed.
 */
export interface PaymentProvider {
  /** The connection this instance acts on behalf of. */
  readonly connection: ProviderConnection;

  /** Begin provider-hosted mandate setup. */
  startMandateSetup(params: StartMandateSetupParams): Promise<StartMandateSetupResult>;

  /** Complete a previously started mandate setup flow. */
  completeMandateSetup(params: CompleteMandateSetupParams): Promise<CompleteMandateSetupResult>;

  /** Fetch the current provider-side status of a mandate. */
  getMandateStatus(providerMandateId: string): Promise<ProviderMandateStatus>;

  /** Cancel a mandate at the provider. */
  cancelMandate(providerMandateId: string): Promise<void>;

  /** Charge a recurring payment against a mandate. */
  chargeRecurring(params: ChargeRecurringParams): Promise<ChargeRecurringResult>;
}

/**
 * Builds club-bound PaymentProvider instances for one provider. A DI singleton:
 * any expensive, connection-independent state (an SDK client, an HTTPS agent)
 * belongs here rather than on the short-lived bound instances.
 */
export interface PaymentProviderFactory {
  readonly name: PaymentProviderName;

  /**
   * Whether this provider has the PLATFORM-level configuration it needs to
   * operate at all (e.g. a Stripe platform secret key). This says nothing about
   * whether any given club has connected: that is the connection's job.
   */
  isConfigured(): boolean;

  create(connection: ProviderConnection): PaymentProvider;
}

/**
 * Verifies and parses one provider's inbound webhooks.
 *
 * Deliberately NOT part of PaymentProvider: this runs before the club is known,
 * and it is the signature check that makes the payload trustworthy enough to
 * read an account id out of in the first place.
 */
export interface WebhookVerifier {
  readonly name: PaymentProviderName;

  /**
   * Verify the raw request body against the platform/partner-level signing
   * secret. Fails closed: an unconfigured secret verifies nothing.
   */
  verify(rawBody: string, signature: string): boolean;

  /** Parse an already-verified raw body into normalised events. */
  parse(rawBody: string): ProviderWebhookEvent[];

  /**
   * The connected-account reference an event belongs to, used to resolve the
   * club. Stripe carries this as the event's `account`; GoCardless Partner
   * carries it as `links.organisation`. Returns null when the payload has none,
   * as is the case for webhooks from Swimly's own legacy account.
   */
  accountRefOf(event: ProviderWebhookEvent): string | null;
}
