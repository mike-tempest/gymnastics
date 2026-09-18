import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { BRAND } from '../../common/brand';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { CreateCommunicationDto } from '../communications/dto/create-communication.dto';
import { Communication, RecipientType } from '../communications/entities/communication.entity';
import { Session, SessionStatus } from '../sessions/entities/session.entity';
import { UpdateSessionDto } from '../sessions/dto/update-session.dto';
import { NotificationDeliveriesService } from './notification-deliveries.service';

@Injectable()
export class OperationalMessagesService {
  constructor(
    private readonly db: DataSource,
    private readonly tenant: TenantContextService,
    private readonly deliveries: NotificationDeliveriesService,
  ) {}

  async broadcast(dto: CreateCommunicationDto): Promise<Communication> {
    const clubId = this.tenant.getClubId();
    return this.db.transaction(async (manager) => {
      if (dto.recipientType === RecipientType.FAMILY) {
        const rows = await manager.query(
          'SELECT family_id FROM families WHERE family_id=$1 AND club_id=$2',
          [dto.familyId, clubId],
        );
        if (!rows.length) throw new BadRequestException('Family not found');
      }
      if (dto.recipientType === RecipientType.SQUAD) {
        const rows = await manager.query(
          'SELECT squad_id FROM squads WHERE squad_id=$1 AND club_id=$2',
          [dto.squadId, clubId],
        );
        if (!rows.length) throw new BadRequestException('Squad not found');
      }
      const families = await manager.query(
        `SELECT family_id,family_name,primary_contact_email FROM families f
        WHERE f.club_id=$1 AND ($2='all' OR ($2='family' AND f.family_id=$3) OR
        ($2='squad' AND EXISTS (SELECT 1 FROM members m WHERE m.club_id=f.club_id AND m.family_id=f.family_id AND m.squad_id=$4)))`,
        [clubId, dto.recipientType, dto.familyId || null, dto.squadId || null],
      );
      const repository = manager.getRepository(Communication);
      const message = await repository.save(
        repository.create({
          club_id: clubId,
          subject: dto.subject,
          body: dto.body,
          recipient_type: dto.recipientType,
          family_id: dto.recipientType === RecipientType.FAMILY ? dto.familyId : null,
          squad_id: dto.recipientType === RecipientType.SQUAD ? dto.squadId : null,
          recipient_count: families.length,
        }),
      );
      const [club] = await manager.query('SELECT name FROM clubs WHERE id=$1', [clubId]);
      // Broadcasts remain operational, matching the existing category. Marketing
      // unsubscribe handling in EmailService is unchanged.
      for (const family of families) {
        await this.deliveries.enqueue(manager, {
          club_id: clubId,
          source_type: 'broadcast',
          source_id: message.communication_id,
          event_key: `broadcast/${message.communication_id}/${family.family_id}`,
          kind: 'broadcast',
          family_id: family.family_id,
          recipient_name: family.family_name,
          recipient_email: family.primary_contact_email,
          subject: `${club?.name ?? BRAND.defaultClubName}: ${dto.subject}`,
          body: dto.body,
        });
      }
      return message;
    });
  }

  async updateSession(id: string, patch: UpdateSessionDto): Promise<Session> {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(Session);
      const session = await repository.findOne({
        where: { session_id: id, club_id: this.tenant.getClubId() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new NotFoundException('Session not found');
      const oldStatus = session.status;
      if (patch.squad_id) {
        const squads = await manager.query(
          'SELECT squad_id FROM squads WHERE squad_id=$1 AND club_id=$2',
          [patch.squad_id, this.tenant.getClubId()],
        );
        if (!squads.length) throw new BadRequestException('Squad not found');
      }
      Object.assign(session, patch, { club_id: this.tenant.getClubId(), session_id: id });
      await repository.save(session);
      await this.sessionChanged(manager, session, oldStatus);
      return repository.findOneOrFail({
        where: { session_id: id, club_id: this.tenant.getClubId() },
        relations: ['squad'],
      });
    });
  }

  /** Called inside the same transaction and lock as the session change. */
  async sessionChanged(
    manager: EntityManager,
    session: Session,
    previousStatus: SessionStatus,
  ): Promise<void> {
    if (session.status === previousStatus) return;
    if (session.status !== SessionStatus.CANCELLED) {
      await manager.query(
        `UPDATE notification_deliveries SET status='suppressed',last_error='Session is no longer cancelled.',lease_token=NULL,lease_until=NULL
        WHERE club_id=$1 AND source_type='session_cancellation' AND source_id=$2 AND status IN ('queued','sending','failed') AND provider_id IS NULL`,
        [session.club_id, session.session_id],
      );
      return;
    }
    if (!session.squad_id) return;
    const event = randomUUID();
    const families = await manager.query(
      `SELECT DISTINCT f.family_id,f.family_name,f.primary_contact_email
      FROM members m JOIN families f ON f.family_id=m.family_id AND f.club_id=m.club_id
      WHERE m.club_id=$1 AND m.squad_id=$2`,
      [session.club_id, session.squad_id],
    );
    const date =
      session.session_date instanceof Date
        ? session.session_date.toISOString().slice(0, 10)
        : String(session.session_date).slice(0, 10);
    const displayDate = date.split('-').reverse().join('/');
    for (const family of families) {
      await this.deliveries.enqueue(manager, {
        club_id: session.club_id,
        source_type: 'session_cancellation',
        source_id: session.session_id,
        event_key: `session/${session.session_id}/${event}/${family.family_id}`,
        kind: 'session_cancellation',
        family_id: family.family_id,
        recipient_name: family.family_name,
        recipient_email: family.primary_contact_email,
        subject: `Session cancelled: ${session.session_name} on ${displayDate}`,
        body: `${session.session_name} on ${displayDate} at ${session.start_time.slice(0, 5)} has been cancelled.\n\n${session.cancellation_reason || 'Please contact your club if you have any questions.'}`,
      });
    }
    const orphans = await manager.query(
      `SELECT member_id,first_name,last_name FROM members WHERE club_id=$1 AND squad_id=$2 AND family_id IS NULL`,
      [session.club_id, session.squad_id],
    );
    for (const member of orphans) {
      await this.deliveries.enqueue(manager, {
        club_id: session.club_id,
        source_type: 'session_cancellation',
        source_id: session.session_id,
        event_key: `session/${session.session_id}/${event}/${member.member_id}`,
        kind: 'session_cancellation',
        recipient_name: `${member.first_name} ${member.last_name}`,
        subject: 'Session cancelled',
        body: '',
        last_error: 'No linked family. Please follow up manually.',
      });
    }
  }
}
