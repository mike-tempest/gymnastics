import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClubPaymentConnection,
  PaymentConnectionStatus,
} from './entities/club-payment-connection.entity';
import { ProviderNotConnectedException } from './provider-not-connected.exception';
import {
  PaymentProviderName,
  ProviderConnection,
} from '../payment-providers/payment-provider.interface';

/**
 * Synthetic account reference for the legacy environment-credentials shim.
 * Never matches a real Stripe `acct_…` or GoCardless organisation id, so it can
 * never collide with a genuine connected account.
 */
export const LEGACY_ENV_ACCOUNT_REF = 'swimly-legacy-env';

/**
 * Resolves which provider account a club transacts on.
 *
 * This is the single source of truth for a club's provider. There is
 * deliberately no separate "chosen provider" setting: connecting an account IS
 * choosing the provider, so the two can never disagree.
 *
 * Reads are unscoped by club_id on purpose. This runs on paths with no tenant
 * context at all (the payment-collection cron, inbound webhooks), so callers
 * pass an explicit clubId and must never rely on CLS here.
 */
@Injectable()
export class PaymentConnectionsService {
  private readonly logger = new Logger(PaymentConnectionsService.name);

  constructor(
    @InjectRepository(ClubPaymentConnection)
    private readonly connectionsRepository: Repository<ClubPaymentConnection>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * The connection a club should transact on, or throw.
   *
   * Throws rather than returning null so that "not connected" can never be
   * mistaken for "bill them through Swimly's account", which is the
   * merchant-of-record behaviour being removed.
   */
  async requireActiveConnection(clubId: string): Promise<ProviderConnection> {
    const active = await this.connectionsRepository.findOne({
      where: { club_id: clubId, status: PaymentConnectionStatus.ACTIVE },
    });

    if (active) {
      return this.toProviderConnection(active);
    }

    const legacy = this.legacyEnvConnection(clubId);
    if (legacy) {
      return legacy;
    }

    // Report WHY there is no active connection: "finish your onboarding" and
    // "you never started" need different actions from the club.
    const any = await this.connectionsRepository.findOne({ where: { club_id: clubId } });
    throw new ProviderNotConnectedException(clubId, any ? any.status : 'none');
  }

  /**
   * Resolve the club behind a provider-side account id. This is how an inbound
   * webhook is routed: the provider names the account, we name the club.
   */
  async findByExternalAccountId(
    provider: PaymentProviderName,
    externalAccountId: string,
  ): Promise<ClubPaymentConnection | null> {
    return this.connectionsRepository.findOne({
      where: { provider, external_account_id: externalAccountId },
    });
  }

  /**
   * The provider a club would transact on right now, or null when it has none.
   *
   * Mirrors requireActiveConnection's resolution order (active row first, then
   * the flag-gated legacy GoCardless environment shim) without throwing and
   * without the shim's warn-log, because this feeds a read-only display field
   * on every /clubs/me call rather than a money movement. With the flag unset
   * (the default) an unconnected club reports null, so the parent portal shows
   * "payments not set up yet" rather than Direct Debit copy for a flow that
   * cannot collect.
   */
  async providerForClub(clubId: string): Promise<PaymentProviderName | null> {
    const active = await this.connectionsRepository.findOne({
      where: { club_id: clubId, status: PaymentConnectionStatus.ACTIVE },
      order: { created_at: 'DESC' },
    });
    if (active) {
      return active.provider as PaymentProviderName;
    }

    if (
      this.legacyEnvFallbackEnabled() &&
      this.configService.get<string>('GOCARDLESS_ACCESS_TOKEN')
    ) {
      return 'gocardless';
    }

    return null;
  }

  /** Every connection for a club, newest first. For admin/status surfaces. */
  async findAllForClub(clubId: string): Promise<ClubPaymentConnection[]> {
    return this.connectionsRepository.find({
      where: { club_id: clubId },
      order: { created_at: 'DESC' },
    });
  }

  /** Counts by status, for the health indicator. Deliberately DB-only. */
  async countByStatus(): Promise<Record<string, number>> {
    const rows: { status: string; count: string }[] = await this.connectionsRepository
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.status')
      .getRawMany();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});
  }

  private toProviderConnection(row: ClubPaymentConnection): ProviderConnection {
    return {
      clubId: row.club_id,
      provider: row.provider as PaymentProviderName,
      externalAccountId: row.external_account_id,
      livemode: row.livemode,
      source: 'connection',
      // Decryption belongs to the GoCardless Partner phase; nothing writes an
      // encrypted token yet, so nothing reads one.
      accessToken: undefined,
    };
  }

  /**
   * Whether the legacy environment-credentials shim is allowed to run at all.
   *
   * OFF by default: Stripe Connect is the payment setup path for every club,
   * so a club with no connection row should be told to connect Stripe, not
   * silently routed through Swimly's shared GoCardless credentials. The flag
   * exists ONLY for local demo environments that seed GoCardless mandates
   * directly, and must never be set in production.
   */
  private legacyEnvFallbackEnabled(): boolean {
    return this.configService.get<string>('LEGACY_GOCARDLESS_ENV_FALLBACK') === 'true';
  }

  /**
   * TEMPORARY, and now OPT-IN: synthesise a connection from Swimly's own
   * environment GoCardless credentials.
   *
   * Originally this kept clubs that predate connected accounts collecting
   * while the connect flows were built. With Stripe Connect live and no live
   * GoCardless activity to protect, it is gated behind
   * LEGACY_GOCARDLESS_ENV_FALLBACK='true' and returns null otherwise, so an
   * unconnected club surfaces ProviderNotConnectedException instead of being
   * routed to credentials that may not move real money.
   *
   * DELETE THIS, the flag, and the GOCARDLESS_ACCESS_TOKEN it reads, the day
   * GoCardless Partner OAuth lands. Every use is warn-logged so it cannot rot
   * quietly.
   */
  private legacyEnvConnection(clubId: string): ProviderConnection | null {
    if (!this.legacyEnvFallbackEnabled()) {
      return null;
    }

    const accessToken = this.configService.get<string>('GOCARDLESS_ACCESS_TOKEN');
    if (!accessToken) {
      return null;
    }

    this.logger.warn(
      `Club ${clubId} has no payment connection; falling back to Swimly's legacy environment ` +
        `GoCardless credentials because LEGACY_GOCARDLESS_ENV_FALLBACK='true'. This shim is ` +
        `for local demo environments only and will be removed when GoCardless Partner OAuth ` +
        `lands. The club should connect its own account.`,
    );

    return {
      clubId,
      provider: 'gocardless',
      externalAccountId: LEGACY_ENV_ACCOUNT_REF,
      // The legacy account is live only when it is pointed at live GoCardless.
      livemode: this.configService.get<string>('GOCARDLESS_ENVIRONMENT') === 'live',
      source: 'env',
      accessToken,
    };
  }
}
