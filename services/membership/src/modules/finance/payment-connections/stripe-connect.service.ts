import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { getStripeConfig } from '../../../config/stripe.config';
import { ClubsRepository } from '../../clubs/clubs.repository';
import {
  ClubPaymentConnection,
  PaymentConnectionStatus,
} from './entities/club-payment-connection.entity';

/**
 * The connection status payload returned by the admin payments endpoints.
 *
 * `configured` is about the PLATFORM (is STRIPE_SECRET_KEY set), everything
 * else is about the CLUB's own connection row. `status: 'none'` means the club
 * has no connection row at all; the legacy GoCardless environment shim is
 * deliberately NOT reported here, because it is invisible plumbing Swimly
 * provides, not a connection the club made.
 */
export interface PaymentConnectionStatusPayload {
  configured: boolean;
  provider: 'stripe' | 'gocardless' | null;
  status: 'none' | 'pending' | 'active' | 'restricted' | 'disconnected';
  livemode: boolean | null;
  external_account_id: string | null;
  capabilities: {
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    requirements_due: string[];
  } | null;
}

/**
 * Stripe Connect Express onboarding and account synchronisation.
 *
 * Owns the platform-key Stripe client for ACCOUNT-level operations (create an
 * Express account, mint onboarding links, read account state). Charging money
 * stays with StripeProvider, which is club-bound; this service is the one place
 * that manages the connection rows those providers are bound from.
 *
 * The same sync logic serves the admin "refresh status" endpoint and the
 * account.updated webhook, so the two can never drift: both call syncAccount().
 */
@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly client: Stripe | null;
  /**
   * Whether the platform key is a live key. The Stripe Account object carries
   * no livemode field, but every object an sk_live_ key touches is live, so the
   * key's own mode is the account's mode.
   */
  private readonly keyLivemode: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ClubPaymentConnection)
    private readonly connectionsRepository: Repository<ClubPaymentConnection>,
    private readonly clubsRepository: ClubsRepository,
  ) {
    const { secretKey } = getStripeConfig(configService);
    this.client = secretKey ? new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' }) : null;
    this.keyLivemode = !!secretKey && /^(sk|rk)_live_/.test(secretKey);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Begin (or resume) Stripe Connect Express onboarding for a club.
   *
   * Idempotent on the Stripe account: a club that already started keeps its
   * account and simply receives a fresh single-use onboarding link (Account
   * Links expire quickly by design). A club actively connected to a DIFFERENT
   * provider is refused: connecting an account IS choosing the provider, and
   * two live providers for one club would make billing ambiguous.
   */
  async startOnboarding(clubId: string): Promise<{ url: string }> {
    const client = this.requireClient();

    const connections = await this.connectionsRepository.find({
      where: { club_id: clubId },
      order: { created_at: 'DESC' },
    });

    const activeOther = connections.find(
      (row) => row.provider !== 'stripe' && row.status === PaymentConnectionStatus.ACTIVE,
    );
    if (activeOther) {
      throw new ConflictException(
        `Your club is already connected to ${activeOther.provider}. Disconnect it before ` +
          `connecting Stripe.`,
      );
    }

    // Reuse an existing Stripe account whatever its state short of
    // disconnected: onboarding may need several visits, and an active account
    // may legitimately be sent back through the link to finish new requirements.
    let connection = connections.find(
      (row) => row.provider === 'stripe' && row.status !== PaymentConnectionStatus.DISCONNECTED,
    );

    if (!connection) {
      const club = await this.clubsRepository.findOne(clubId);
      if (!club) {
        throw new NotFoundException(`Club ${clubId} not found`);
      }

      // business_type and all identity details are deliberately omitted: the
      // hosted Express onboarding collects them, which is the whole point of
      // using it.
      const account = await client.accounts.create({
        type: 'express',
        country: club.country,
        email: club.contact_email ?? undefined,
        metadata: { club_id: clubId },
      });

      connection = await this.connectionsRepository.save(
        this.connectionsRepository.create({
          club_id: clubId,
          provider: 'stripe',
          external_account_id: account.id,
          status: PaymentConnectionStatus.PENDING,
          capabilities: {},
          livemode: this.keyLivemode,
        }),
      );

      this.logger.log(
        `Created Stripe Express account ${account.id} for club ${clubId} (livemode ` +
          `${this.keyLivemode})`,
      );
    }

    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const link = await client.accountLinks.create({
      account: connection.external_account_id,
      type: 'account_onboarding',
      return_url: `${appUrl}/admin/settings?stripe=return`,
      refresh_url: `${appUrl}/admin/settings?stripe=refresh`,
    });

    return { url: link.url };
  }

  /**
   * Pull the club's Stripe account state and persist it. The admin "sync"
   * endpoint.
   */
  async syncForClub(clubId: string): Promise<PaymentConnectionStatusPayload> {
    this.requireClient();

    const connection = await this.connectionsRepository.findOne({
      where: { club_id: clubId, provider: 'stripe' },
      order: { created_at: 'DESC' },
    });
    if (!connection) {
      throw new NotFoundException('Your club has not started connecting Stripe.');
    }

    const updated = await this.syncAccount(connection);
    return this.toStatusPayload(updated);
  }

  /**
   * Webhook-driven sync: Stripe told us a connected account changed
   * (account.updated). Unknown accounts and an unconfigured platform are
   * tolerated silently; a webhook cannot fix either, and the webhook endpoint
   * must keep answering 200.
   */
  async syncByAccountId(externalAccountId: string): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        `Ignoring account.updated for ${externalAccountId}: STRIPE_SECRET_KEY is not configured.`,
      );
      return;
    }

    const connection = await this.connectionsRepository.findOne({
      where: { provider: 'stripe', external_account_id: externalAccountId },
    });
    if (!connection) {
      this.logger.warn(`Ignoring account.updated for unknown Stripe account ${externalAccountId}.`);
      return;
    }

    await this.syncAccount(connection);
  }

  /**
   * The club's connection status for the admin settings page. Never calls
   * Stripe: it reports what is persisted, and the sync endpoint is how the
   * persisted state is refreshed.
   */
  async getStatusForClub(clubId: string): Promise<PaymentConnectionStatusPayload> {
    const connection = await this.connectionsRepository.findOne({
      where: { club_id: clubId },
      order: { created_at: 'DESC' },
    });

    if (!connection) {
      return {
        configured: this.isConfigured(),
        provider: null,
        status: 'none',
        livemode: null,
        external_account_id: null,
        capabilities: null,
      };
    }

    return this.toStatusPayload(connection);
  }

  /** Fetch the account from Stripe and mirror its state onto the row. */
  private async syncAccount(connection: ClubPaymentConnection): Promise<ClubPaymentConnection> {
    const client = this.requireClient();
    const account = await client.accounts.retrieve(connection.external_account_id);

    connection.capabilities = {
      charges_enabled: account.charges_enabled === true,
      payouts_enabled: account.payouts_enabled === true,
      details_submitted: account.details_submitted === true,
      requirements_due: account.requirements?.currently_due ?? [],
    };
    connection.livemode = this.keyLivemode;

    const previousStatus = connection.status;
    connection.status = this.statusFor(account);
    if (
      connection.status === PaymentConnectionStatus.ACTIVE &&
      previousStatus !== PaymentConnectionStatus.ACTIVE
    ) {
      connection.connected_at = new Date();
    }

    const saved = await this.connectionsRepository.save(connection);
    this.logger.log(
      `Synced Stripe account ${connection.external_account_id} for club ` +
        `${connection.club_id}: ${previousStatus} -> ${saved.status}`,
    );
    return saved;
  }

  /**
   * Map Stripe account state onto the connection lifecycle.
   *
   * Active means chargeable: details submitted AND charges enabled. Restricted
   * is a connection that WAS submitted but Stripe has since disabled (the
   * disabled_reason names why). An account still mid-onboarding also carries a
   * disabled_reason (requirements.past_due), so disabled_reason alone does not
   * mean restricted; details_submitted is what separates "never finished" from
   * "finished and then limited".
   */
  private statusFor(account: Stripe.Account): PaymentConnectionStatus {
    if (account.details_submitted && account.charges_enabled) {
      return PaymentConnectionStatus.ACTIVE;
    }
    if (account.details_submitted && account.requirements?.disabled_reason) {
      return PaymentConnectionStatus.RESTRICTED;
    }
    return PaymentConnectionStatus.PENDING;
  }

  private toStatusPayload(connection: ClubPaymentConnection): PaymentConnectionStatusPayload {
    return {
      configured: this.isConfigured(),
      provider: connection.provider as 'stripe' | 'gocardless',
      status: connection.status,
      livemode: connection.livemode,
      external_account_id: connection.external_account_id,
      capabilities: {
        charges_enabled: connection.capabilities?.charges_enabled === true,
        payouts_enabled: connection.capabilities?.payouts_enabled === true,
        details_submitted: connection.capabilities?.details_submitted === true,
        requirements_due: connection.capabilities?.requirements_due ?? [],
      },
    };
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Stripe is not configured on this platform yet. Set STRIPE_SECRET_KEY to enable it.',
      );
    }
    return this.client;
  }
}
