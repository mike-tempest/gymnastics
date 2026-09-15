import { PaymentTokenCipher, paymentTokenContext } from './payment-token-cipher';
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
   * Reports only a real active connection without decrypting its credentials.
   * This feeds a read-only display field
   * on every /clubs/me call rather than a money movement.
   * An unconnected club reports null, so the parent portal shows
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
      accessToken:
        row.provider === 'gocardless'
          ? new PaymentTokenCipher(this.configService).decrypt(
              row.access_token_encrypted,
              row.encryption_key_id,
              paymentTokenContext(row),
            )
          : undefined,
    };
  }
}
