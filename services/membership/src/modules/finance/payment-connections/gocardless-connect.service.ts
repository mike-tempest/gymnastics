import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { GoCardlessClient } from 'gocardless-nodejs/client';
import { Environments } from 'gocardless-nodejs/constants';
import {
  ClubPaymentConnection,
  PaymentConnectionStatus as Status,
} from './entities/club-payment-connection.entity';
import { PaymentTokenCipher, paymentTokenContext } from './payment-token-cipher';

@Injectable()
export class GoCardlessConnectService {
  private readonly cipher: PaymentTokenCipher;
  constructor(
    private readonly config: ConfigService,
    private readonly db: DataSource,
  ) {
    this.cipher = new PaymentTokenCipher(config);
  }

  private settings() {
    const environment = this.config.get<string>('GOCARDLESS_ENVIRONMENT', 'sandbox');
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const redirect = new URL('/admin/settings', appUrl).toString();
    const live = environment === 'live';
    if (!['sandbox', 'live'].includes(environment) || (live && !redirect.startsWith('https://')))
      throw new ServiceUnavailableException('Invalid payment environment.');
    return {
      live,
      redirect,
      host: live ? 'https://connect.gocardless.com' : 'https://connect-sandbox.gocardless.com',
      clientId: this.config.get<string>('GOCARDLESS_CLIENT_ID', ''),
      clientSecret: this.config.get<string>('GOCARDLESS_CLIENT_SECRET', ''),
    };
  }

  isConfigured(): boolean {
    try {
      const s = this.settings();
      return !!(s.clientId && s.clientSecret && this.cipher.isConfigured());
    } catch {
      return false;
    }
  }

  private requireSettings() {
    if (!this.isConfigured())
      throw new ServiceUnavailableException('GoCardless connection setup is unavailable.');
    return this.settings();
  }

  private async locked<T>(clubId: string, work: (m: EntityManager) => Promise<T>): Promise<T> {
    return this.db.transaction(async (m) => {
      await m.query('SELECT id FROM clubs WHERE id = $1 FOR UPDATE', [clubId]);
      return work(m);
    });
  }

  private async assertAvailable(m: EntityManager, clubId: string) {
    const rows = await m.find(ClubPaymentConnection, { where: { club_id: clubId } });
    if (rows.some((r) => r.provider !== 'gocardless' && r.status !== Status.DISCONNECTED)) {
      throw new ConflictException(
        'An existing payment connection must be resolved before connecting GoCardless.',
      );
    }
    return rows.find((r) => r.provider === 'gocardless');
  }

  async start(clubId: string, userId: string) {
    const s = this.requireSettings();
    const state = randomBytes(32).toString('hex');
    await this.locked(clubId, async (m) => {
      await this.assertAvailable(m, clubId);
      await m.query(
        'DELETE FROM payment_oauth_states WHERE expires_at < now() OR (club_id = $1 AND user_id = $2)',
        [clubId, userId],
      );
      await m.query(
        `INSERT INTO payment_oauth_states VALUES ($1,$2,$3,$4,$5,now()+interval '10 minutes')`,
        [this.hash(state), clubId, userId, s.live, s.redirect],
      );
    });
    const url = new URL('/oauth/authorize', s.host);
    url.search = new URLSearchParams({
      client_id: s.clientId,
      redirect_uri: s.redirect,
      response_type: 'code',
      scope: 'read_write',
      initial_view: 'login',
      state,
    }).toString();
    return { url: url.toString() };
  }

  async complete(clubId: string, userId: string, code: string, state: string) {
    const s = this.requireSettings();
    // Consume before exchanging the code. An interrupted exchange requires a new connect attempt.
    const consumed = await this.db.query(
      `DELETE FROM payment_oauth_states WHERE state_hash=$1
      AND club_id=$2 AND user_id=$3 AND livemode=$4 AND redirect_uri=$5 AND expires_at > now() RETURNING state_hash`,
      [this.hash(state), clubId, userId, s.live, s.redirect],
    );
    if (!consumed[0]?.length)
      throw new BadRequestException(
        'This connection request has expired or was already used. Start again.',
      );
    let token: { access_token?: string; organisation_id?: string };
    try {
      const response = await fetch(`${s.host}/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: s.clientId,
          client_secret: s.clientSecret,
          redirect_uri: s.redirect,
          code,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error();
      token = (await response.json()) as typeof token;
      if (
        typeof token.access_token !== 'string' ||
        !token.access_token ||
        typeof token.organisation_id !== 'string' ||
        !/^OR[a-zA-Z0-9]+$/.test(token.organisation_id)
      )
        throw new Error();
    } catch {
      throw new BadRequestException(
        'GoCardless authorisation could not be completed. Please start again.',
      );
    }
    const encrypted = this.cipher.encrypt(
      token.access_token!,
      paymentTokenContext({
        club_id: clubId,
        external_account_id: token.organisation_id!,
        livemode: s.live,
      }),
    );
    try {
      await this.locked(clubId, async (m) => {
        const previous = await this.assertAvailable(m, clubId);
        if (
          previous &&
          (previous.external_account_id !== token.organisation_id || previous.livemode !== s.live)
        ) {
          throw new ConflictException(
            'Reconnect the same GoCardless organisation and environment to preserve existing mandates.',
          );
        }
        const row = m.create(ClubPaymentConnection, {
          ...previous,
          club_id: clubId,
          provider: 'gocardless',
          external_account_id: token.organisation_id!,
          livemode: s.live,
          access_token_encrypted: encrypted.encrypted,
          encryption_key_id: encrypted.keyId,
          status: Status.PENDING,
          disconnected_at: null,
          connected_at: new Date(),
        });
        await this.refreshRow(row);
        await m.save(row);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException('This payment account is already connected.');
      throw error;
    }
    return this.getStatus(clubId);
  }

  private client(row: ClubPaymentConnection) {
    if (row.livemode !== this.settings().live)
      throw new ServiceUnavailableException('Payment environment does not match this connection.');
    return new GoCardlessClient(
      this.cipher.decrypt(
        row.access_token_encrypted,
        row.encryption_key_id,
        paymentTokenContext(row),
      ),
      row.livemode ? Environments.Live : Environments.Sandbox,
    );
  }

  private async refreshRow(row: ClubPaymentConnection) {
    let result;
    try {
      result = await this.client(row).creditors.list({ limit: '2' });
    } catch (error) {
      if (Number((error as { code?: string }).code) === 401) {
        row.status = Status.DISCONNECTED;
        row.access_token_encrypted = null;
        row.encryption_key_id = null;
        row.disconnected_at = new Date();
        row.capabilities = {};
        return;
      }
      throw new ServiceUnavailableException('Could not check GoCardless verification. Try again.');
    }
    // Multiple creditors require explicit selection; never guess which one receives money.
    const creditor = result.creditors.length === 1 ? result.creditors[0] : null;
    const ready = creditor?.verification_status === 'successful';
    row.capabilities = {
      charges_enabled: ready,
      payouts_enabled: ready,
      details_submitted: ready,
      requirements_due: ready
        ? []
        : [
            creditor
              ? `GoCardless verification: ${creditor.verification_status ?? 'unknown'}`
              : 'Contact support to select a creditor.',
          ],
    };
    row.status = ready ? Status.ACTIVE : Status.PENDING;
  }

  async sync(clubId: string) {
    this.requireSettings();
    await this.locked(clubId, async (m) => {
      const row = await m.findOneBy(ClubPaymentConnection, {
        club_id: clubId,
        provider: 'gocardless',
      });
      if (!row || row.status === Status.DISCONNECTED) return;
      await this.refreshRow(row);
      await m.save(row);
    });
    return this.getStatus(clubId);
  }

  async disconnect(clubId: string) {
    await this.locked(clubId, async (m) => {
      await m.update(
        ClubPaymentConnection,
        { club_id: clubId, provider: 'gocardless' },
        {
          status: Status.DISCONNECTED,
          access_token_encrypted: null,
          encryption_key_id: null,
          disconnected_at: new Date(),
          capabilities: {},
        },
      );
      await m.query('DELETE FROM payment_oauth_states WHERE club_id=$1', [clubId]);
    });
    return this.getStatus(clubId);
  }

  async getStatus(clubId: string) {
    const row = await this.db
      .getRepository(ClubPaymentConnection)
      .findOneBy({ club_id: clubId, provider: 'gocardless' });
    return {
      configured: this.isConfigured(),
      provider: 'gocardless',
      status: row?.status ?? 'none',
      livemode: row?.livemode ?? null,
      external_account_id: row?.external_account_id ?? null,
      capabilities: row?.capabilities ?? null,
    };
  }

  async reconcileMandates(clubId: string) {
    const row = await this.db
      .getRepository(ClubPaymentConnection)
      .findOneBy({ club_id: clubId, provider: 'gocardless' });
    if (!row || row.status === Status.DISCONNECTED)
      throw new BadRequestException('Connect GoCardless first.');
    const client = this.client(row);
    const mandates: { mandate_id: string; provider_mandate_id: string }[] = await this.db.query(
      "SELECT mandate_id, provider_mandate_id FROM direct_debit_mandates WHERE club_id=$1 AND provider='gocardless' ORDER BY mandate_id LIMIT 501",
      [clubId],
    );
    if (mandates.length > 500)
      throw new BadRequestException('More than 500 mandates require a supported migration review.');
    const results = [];
    for (const mandate of mandates) {
      let status = 'verified';
      try {
        await client.mandates.find(mandate.provider_mandate_id);
      } catch (e) {
        status = Number((e as { code?: string }).code) === 404 ? 'not_in_account' : 'unverified';
      }
      results.push({
        mandate_id: mandate.mandate_id,
        provider_mandate_id: mandate.provider_mandate_id,
        status,
      });
    }
    return { results };
  }

  private hash(state: string) {
    return createHash('sha256').update(state).digest('hex');
  }
}
