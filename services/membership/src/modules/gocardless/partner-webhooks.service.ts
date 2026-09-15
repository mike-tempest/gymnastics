import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { GoCardlessClient } from 'gocardless-nodejs/client';
import { Environments } from 'gocardless-nodejs/constants';
import {
  ClubPaymentConnection,
  PaymentConnectionStatus,
} from '../finance/payment-connections/entities/club-payment-connection.entity';
import {
  PaymentTokenCipher,
  paymentTokenContext,
} from '../finance/payment-connections/payment-token-cipher';
import { GoCardlessWebhookEvent, WebhooksService } from './webhooks.service';

/** Serialises partner events per club and reads current provider state before applying it. */
@Injectable()
export class PartnerWebhooksService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly handler: WebhooksService,
  ) {}

  async handle(event: GoCardlessWebhookEvent, clubId: string): Promise<void> {
    await this.db.transaction(async (m) => {
      await m.query('SELECT id FROM clubs WHERE id=$1 FOR UPDATE', [clubId]);
      const row = await m.findOneBy(ClubPaymentConnection, {
        club_id: clubId,
        provider: 'gocardless',
        external_account_id: event.links.organisation,
      });
      if (!row || row.status === PaymentConnectionStatus.DISCONNECTED) return;
      if (
        row.livemode !==
        (this.config.get<string>('GOCARDLESS_ENVIRONMENT', 'sandbox') === 'live')
      )
        return;
      const token = new PaymentTokenCipher(this.config).decrypt(
        row.access_token_encrypted,
        row.encryption_key_id,
        paymentTokenContext(row),
      );
      const client = new GoCardlessClient(
        token,
        row.livemode ? Environments.Live : Environments.Sandbox,
      );
      if (event.resource_type === 'organisations' && event.action === 'disconnected') {
        // A delayed disconnection for an old token must not disable a subsequent reconnect.
        try {
          await client.creditors.list({ limit: '1' });
          return;
        } catch (error) {
          if (Number((error as { code?: string }).code) !== 401)
            throw new ServiceUnavailableException('Could not verify disconnection.');
        }
        row.status = PaymentConnectionStatus.DISCONNECTED;
        row.access_token_encrypted = null;
        row.encryption_key_id = null;
        row.capabilities = {};
        row.disconnected_at = new Date();
        await m.save(row);
        return;
      }
      if (!event.id) return;
      const receipts = await m.query(
        'SELECT event_id FROM gocardless_webhook_receipts WHERE event_id=$1',
        [event.id],
      );
      if (receipts.length) return;
      if (!['mandates', 'payments'].includes(event.resource_type)) return;
      const isMandate = event.resource_type === 'mandates';
      const resourceId = isMandate ? event.links.mandate : event.links.payment;
      // SQL identifiers are selected from fixed strings, never webhook input.
      const table = isMandate ? 'direct_debit_mandates' : 'payments';
      const column = isMandate ? 'provider_mandate_id' : 'provider_payment_id';
      const records = await m.query(
        `SELECT club_id FROM ${table} WHERE provider='gocardless' AND ${column}=$1`,
        [resourceId],
      );
      // Unknown resources may be unrelated dashboard activity; do not apply them to another club.
      if (records.length && records[0].club_id !== clubId) return;
      if (!records.length) {
        // Allow the local create transaction to finish, but do not retry unrelated
        // dashboard activity indefinitely. A missing timestamp cannot prove recency.
        const age = Date.now() - Date.parse(event.created_at ?? '');
        if (age >= 0 && age < 10 * 60_000)
          throw new ServiceUnavailableException('Payment record is not available yet.');
        return;
      }
      let status: string | undefined;
      try {
        status = isMandate
          ? (await client.mandates.find(resourceId)).status
          : (await client.payments.find(resourceId)).status;
      } catch {
        throw new ServiceUnavailableException('Could not read current payment state.');
      }
      const action = isMandate
        ? (
            {
              pending_customer_approval: 'created',
              pending_submission: 'created',
              submitted: 'submitted',
              active: 'active',
              failed: 'failed',
              cancelled: 'cancelled',
              expired: 'expired',
            } as Record<string, string>
          )[status ?? '']
        : (
            {
              pending_submission: 'created',
              submitted: 'submitted',
              confirmed: 'confirmed',
              paid_out: 'confirmed',
              failed: 'failed',
              cancelled: 'cancelled',
              charged_back: 'charged_back',
            } as Record<string, string>
          )[status ?? ''];
      if (!action) return;
      await this.handler.handleEvent(
        { ...event, action, details: action === event.action ? event.details : undefined },
        clubId,
      );
      await m.query('INSERT INTO gocardless_webhook_receipts (event_id, club_id) VALUES ($1,$2)', [
        event.id,
        clubId,
      ]);
    });
  }
}
