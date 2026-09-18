import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { EmailService } from '../email/email.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import {
  Delivery,
  MAX_ATTEMPTS,
  mayRetry,
  NewDelivery,
  NotificationSource,
} from './notification-deliveries.types';

@Injectable()
export class NotificationDeliveriesService {
  private running = false;
  private readonly logger = new Logger(NotificationDeliveriesService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly email: EmailService,
    private readonly tenant: TenantContextService,
  ) {}

  /** Must use the same transaction as the business change. Event keys are immutable. */
  async enqueue(manager: EntityManager, row: NewDelivery): Promise<void> {
    const address = row.recipient_email?.trim().toLowerCase() || null;
    const error =
      row.last_error || (!address ? 'No eligible email address. Please follow up manually.' : null);
    await manager.query(
      `INSERT INTO notification_deliveries
      (club_id,source_type,source_id,event_key,kind,recipient_name,recipient_email,recipient_user_id,family_id,subject,body,available_at,status,last_error)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (club_id,event_key) DO NOTHING`,
      [
        row.club_id,
        row.source_type,
        row.source_id,
        row.event_key,
        row.kind,
        row.recipient_name,
        address,
        row.recipient_user_id || null,
        row.family_id || null,
        row.subject,
        row.body,
        row.available_at || new Date(),
        error ? 'failed' : 'queued',
        error,
      ],
    );
  }

  @Cron('*/30 * * * * *')
  async processDue(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconcileProviderEvents();
      // Across processes, SKIP LOCKED claims each row once. Expired leases
      // survive restarts; the same provider key covers an uncertain attempt.
      for (let i = 0; i < 20; i++) {
        const token = randomUUID();
        const rows: Delivery[] = await this.dataSource.query(
          `WITH next AS (
          SELECT delivery_id FROM notification_deliveries
          WHERE (status='queued' AND available_at<=now()) OR (status='sending' AND lease_until<now())
          ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1
        ), claimed AS (UPDATE notification_deliveries d SET status='sending',lease_until=now()+interval '5 minutes',lease_token=$1
          FROM next WHERE d.delivery_id=next.delivery_id RETURNING d.*) SELECT * FROM claimed`,
          [token],
        );
        if (!rows[0]) break;
        await this.deliver(rows[0]);
      }
    } catch {
      this.logger.error(
        'Notification worker could not complete its database operation; durable work remains queued.',
      );
    } finally {
      this.running = false;
    }
  }

  async deliver(row: Delivery): Promise<void> {
    if (!mayRetry(row)) {
      await this.finish(
        row,
        'failed',
        'Delivery outcome is uncertain after the safe retry period. Please follow up manually.',
      );
      return;
    }
    if (!(await this.stillEligible(row))) {
      await this.finish(
        row,
        'suppressed',
        'Recipient or commitment is no longer eligible. Please check current details.',
      );
      return;
    }
    if (!this.email.isConfigured()) {
      await this.finish(
        row,
        'failed',
        'Email provider is not configured. Retry after configuration or follow up manually.',
      );
      return;
    }
    const started = await this.dataSource.query(
      `WITH started AS (UPDATE notification_deliveries SET first_attempt_at=COALESCE(first_attempt_at,now()),attempts=attempts+1 WHERE delivery_id=$1 AND lease_token=$2 AND status='sending' RETURNING delivery_id) SELECT * FROM started`,
      [row.delivery_id, row.lease_token],
    );
    if (!started.length) return;
    try {
      const providerId = await this.email.sendOperationalEmail({
        to: row.recipient_email!,
        subject: row.subject,
        text: row.body,
        idempotencyKey: `tumblebase-delivery/${row.delivery_id}`,
      });
      await this.dataSource.query(
        // Acceptance is evidence about the immutable delivery, even if cancellation
        // revoked the lease while the provider request was in flight. Preserve
        // already-reconciled delivery/bounce evidence from another worker.
        `UPDATE notification_deliveries SET
          status=CASE WHEN provider_id IS NOT NULL AND status IN ('delivered','failed','suppressed') THEN status ELSE 'provider_accepted' END,
          last_error=CASE WHEN provider_id IS NOT NULL AND status IN ('failed','suppressed') THEN last_error ELSE NULL END,
          provider_id=$2,sent_at=COALESCE(sent_at,now()),lease_until=NULL,lease_token=NULL
          WHERE delivery_id=$1 AND club_id=$3`,
        [row.delivery_id, providerId, row.club_id],
      );
      await this.reconcileProviderEvents();
    } catch {
      // Never expose provider errors which may contain recipient addresses or secrets.
      const exhausted = row.attempts + 1 >= MAX_ATTEMPTS;
      await this.dataSource.query(
        `UPDATE notification_deliveries SET status=$3,last_error=$4,available_at=now()+($5 * interval '1 second'),lease_until=NULL WHERE delivery_id=$1 AND lease_token=$2 AND status='sending'`,
        [
          row.delivery_id,
          row.lease_token,
          exhausted ? 'failed' : 'queued',
          exhausted
            ? 'Email was not confirmed after repeated attempts. Please follow up or retry.'
            : 'Email provider unavailable. Another attempt is queued.',
          Math.min(3600, 60 * 2 ** row.attempts),
        ],
      );
    }
  }

  private async finish(
    row: Delivery,
    status: 'failed' | 'suppressed',
    error: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE notification_deliveries SET status=$3,last_error=$4,lease_until=NULL WHERE delivery_id=$1 AND lease_token=$2`,
      [row.delivery_id, row.lease_token, status, error],
    );
  }

  private async stillEligible(row: Delivery): Promise<boolean> {
    if (row.source_type === 'session_cancellation') {
      const sessions = await this.dataSource.query(
        "SELECT session_id FROM sessions WHERE session_id=$1 AND club_id=$2 AND status='cancelled'",
        [row.source_id, row.club_id],
      );
      if (!sessions.length) return false;
    }
    if (row.family_id) {
      const families = await this.dataSource.query(
        'SELECT family_id FROM families WHERE family_id=$1 AND club_id=$2 AND lower(trim(primary_contact_email))=$3',
        [row.family_id, row.club_id, row.recipient_email],
      );
      if (!families.length) return false;
    }
    return Boolean(row.recipient_email);
  }

  async recordProviderEvent(
    providerId: string,
    status: 'delivered' | 'failed' | 'suppressed',
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO notification_delivery_events(provider_id,status) VALUES($1,$2)
      ON CONFLICT(provider_id) DO UPDATE SET status=CASE WHEN notification_delivery_events.status IN ('failed','suppressed') THEN notification_delivery_events.status ELSE EXCLUDED.status END`,
      [providerId, status],
    );
    await this.reconcileProviderEvents();
  }
  private async reconcileProviderEvents(): Promise<void> {
    await this.dataSource.query(`UPDATE notification_deliveries d SET status=e.status,
      delivered_at=CASE WHEN e.status='delivered' THEN e.received_at ELSE d.delivered_at END,
      last_error=CASE WHEN e.status='suppressed' THEN 'The provider suppressed this email. Please follow up manually.' WHEN e.status='failed' THEN 'The provider reported a delivery failure. Please follow up manually.' ELSE NULL END
      FROM notification_delivery_events e WHERE d.provider_id=e.provider_id AND d.status IN ('provider_accepted','delivered') AND d.status<>e.status`);
  }

  async list(source: NotificationSource, sourceId: string, page = 0) {
    // Do not disclose addresses, payloads or provider ids in the organiser UI.
    return this.dataSource.query(
      `SELECT delivery_id,recipient_name,NULL AS recipient_email,status,attempts,last_error,follow_up_note,followed_up_at,sent_at,delivered_at,kind,created_at,
      (status='failed' AND provider_id IS NULL AND recipient_email IS NOT NULL AND (first_attempt_at IS NULL OR first_attempt_at>now()-interval '23 hours')) AS retryable
      FROM notification_deliveries WHERE club_id=$1 AND source_type=$2 AND source_id=$3 ORDER BY created_at DESC,delivery_id DESC LIMIT 101 OFFSET $4`,
      [this.tenant.getClubId(), source, sourceId, page * 100],
    );
  }
  async find(id: string): Promise<Delivery> {
    const rows = await this.dataSource.query(
      `SELECT * FROM notification_deliveries WHERE delivery_id=$1 AND club_id=$2`,
      [id, this.tenant.getClubId()],
    );
    if (!rows[0]) throw new NotFoundException('Notification not found');
    return rows[0];
  }
  async retry(id: string): Promise<void> {
    const row = await this.find(id);
    if (
      row.status !== 'failed' ||
      (row as Delivery & { provider_id?: string }).provider_id ||
      !row.recipient_email ||
      !mayRetry(row)
    )
      throw new BadRequestException(
        'This notification needs manual follow-up rather than another email attempt.',
      );
    await this.dataSource.query(
      `UPDATE notification_deliveries SET status='queued',available_at=now(),last_error=NULL WHERE delivery_id=$1 AND club_id=$2 AND status='failed' AND provider_id IS NULL AND (first_attempt_at IS NULL OR first_attempt_at>now()-interval '23 hours')`,
      [id, this.tenant.getClubId()],
    );
  }
  async followUp(id: string, note: string, userId: string): Promise<void> {
    await this.find(id);
    await this.dataSource.query(
      `UPDATE notification_deliveries SET follow_up_note=$3,followed_up_at=now(),followed_up_by=$4 WHERE delivery_id=$1 AND club_id=$2`,
      [id, this.tenant.getClubId(), note, userId],
    );
  }
}
