import 'reflect-metadata';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { NotificationDeliveriesService } from '../modules/notification-deliveries/notification-deliveries.service';
import { OperationalMessagesService } from '../modules/notification-deliveries/operational-messages.service';
import { EmailService } from '../modules/email/email.service';
import { TenantContextService } from '../common/tenancy/tenant-context.service';
import { RecipientType } from '../modules/communications/entities/communication.entity';
import { Session, SessionStatus } from '../modules/sessions/entities/session.entity';
import { TimetableService } from '../modules/sessions/timetable.service';

const db = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: 55465,
  username: 'tumblebase_test',
  password: 'tumblebase_test',
  database: 'tumblebase_delivery_test',
  entities: [join(__dirname, '../**/*.entity.ts')],
  migrations: [join(__dirname, '../database/migrations/*.ts')],
  synchronize: false,
});
let club: string, otherClub: string, family: string, squad: string, sessionId: string;
const send = jest.fn();
const email = { isConfigured: () => true, sendOperationalEmail: send } as unknown as EmailService;
let deliveries: NotificationDeliveriesService, messages: OperationalMessagesService;
let tenant: TenantContextService;
beforeAll(async () => {
  await db.initialize();
  await db.runMigrations();
  // Roll back through the delivery migration even when later migrations exist.
  const applied: { name: string }[] = await db.query(
    'SELECT name FROM migrations ORDER BY id DESC',
  );
  const deliveryMigration = applied.findIndex(
    ({ name }) => name === 'AddNotificationDeliveries1789690000000',
  );
  expect(deliveryMigration).toBeGreaterThanOrEqual(0);
  for (let index = 0; index <= deliveryMigration; index++) {
    await db.undoLastMigration();
  }
  expect(
    (await db.query("SELECT to_regclass('notification_deliveries') AS name"))[0].name,
  ).toBeNull();
  await db.runMigrations();
});
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.query('TRUNCATE notification_deliveries, notification_delivery_events');
  club = randomUUID();
  otherClub = randomUUID();
  family = randomUUID();
  squad = randomUUID();
  sessionId = randomUUID();
  await db.query(
    "INSERT INTO clubs(id,name,slug) VALUES($1::uuid,'Test',$1::text),($2::uuid,'Other',$2::text)",
    [club, otherClub],
  );
  await db.query(
    "INSERT INTO families(family_id,club_id,family_name,primary_contact_name,primary_contact_email) VALUES($1,$2,'Test Family','Test Parent','controlled@example.test')",
    [family, club],
  );
  await db.query(
    "INSERT INTO squads(squad_id,club_id,squad_name,max_capacity) VALUES($1,$2,'Explore',30)",
    [squad, club],
  );
  await db.query(
    "INSERT INTO members(club_id,family_id,squad_id,first_name,last_name,dob,gender) VALUES($1,$2,$3,'Test','Child','2016-01-01','female')",
    [club, family, squad],
  );
  await db.query(
    "INSERT INTO sessions(session_id,club_id,squad_id,session_name,session_date,start_time,end_time,status) VALUES($1,$2,$3,'Explore',CURRENT_DATE+5,'16:00','17:00','scheduled')",
    [sessionId, club, squad],
  );
  tenant = { getClubId: () => club } as TenantContextService;
  deliveries = new NotificationDeliveriesService(db, email, tenant);
  messages = new OperationalMessagesService(db, tenant, deliveries);
  send.mockReset().mockImplementation(async () => randomUUID());
});
const broadcast = () =>
  messages.broadcast({
    subject: 'Test operational broadcast',
    body: 'Test only',
    recipientType: RecipientType.ALL,
  });
const rows = () => db.query('SELECT * FROM notification_deliveries WHERE club_id=$1', [club]);
it('atomically stores broadcasts and recipient work, including missing emails', async () => {
  await db.query(
    "INSERT INTO families(club_id,family_name,primary_contact_name,primary_contact_email) VALUES($1,'Missing','Missing','')",
    [club],
  );
  const message = await broadcast();
  expect(message.recipient_count).toBe(2);
  expect((await rows()).map((r: { status: string }) => r.status).sort()).toEqual([
    'failed',
    'queued',
  ]);
  const enqueue = jest
    .spyOn(deliveries, 'enqueue')
    .mockRejectedValueOnce(new Error('database failed'));
  await expect(broadcast()).rejects.toThrow('database failed');
  enqueue.mockRestore();
  expect((await db.query('SELECT * FROM communications WHERE club_id=$1', [club])).length).toBe(1);
});
it('never accepts another club family or squad and restricts list/retry/follow-up', async () => {
  const message = await broadcast();
  const row = (await rows())[0];
  const foreignTenant = { getClubId: () => otherClub } as TenantContextService;
  const foreign = new NotificationDeliveriesService(db, email, foreignTenant);
  const foreignMessages = new OperationalMessagesService(db, foreignTenant, foreign);
  expect(await foreign.list('broadcast', message.communication_id)).toEqual([]);
  await expect(foreign.retry(row.delivery_id)).rejects.toThrow('Notification not found');
  await expect(foreign.followUp(row.delivery_id, 'Called', randomUUID())).rejects.toThrow(
    'Notification not found',
  );
  await expect(
    foreignMessages.broadcast({
      subject: 'Test',
      body: 'Test',
      recipientType: RecipientType.FAMILY,
      familyId: family,
    }),
  ).rejects.toThrow('Family not found');
  await expect(
    foreignMessages.updateSession(sessionId, { status: SessionStatus.CANCELLED }),
  ).rejects.toThrow('Session not found');
});
it('retries uncertainty with the same immutable key and stops after acceptance', async () => {
  await broadcast();
  send.mockRejectedValueOnce(new Error('timeout'));
  await deliveries.processDue();
  expect((await rows())[0].status).toBe('queued');
  await db.query('UPDATE notification_deliveries SET available_at=now()');
  await new NotificationDeliveriesService(db, email, tenant).processDue();
  expect(send.mock.calls[0][0]).toEqual(send.mock.calls[1][0]);
  expect((await rows())[0].status).toBe('provider_accepted');
  await deliveries.processDue();
  expect(send).toHaveBeenCalledTimes(2);
  await expect(deliveries.retry((await rows())[0].delivery_id)).rejects.toThrow();
});
it('claims work once across workers and recovers expired leases', async () => {
  await broadcast();
  await db.query(
    "UPDATE notification_deliveries SET status='sending',lease_until=now()-interval '1 minute',lease_token=$1",
    [randomUUID()],
  );
  await Promise.all([
    deliveries.processDue(),
    new NotificationDeliveriesService(db, email, tenant).processDue(),
  ]);
  expect(send).toHaveBeenCalledTimes(1);
});
it('never retries beyond provider deduplication retention', async () => {
  await broadcast();
  await db.query("UPDATE notification_deliveries SET first_attempt_at=now()-interval '24 hours'");
  await deliveries.processDue();
  expect(send).not.toHaveBeenCalled();
  expect((await rows())[0].status).toBe('failed');
  await expect(deliveries.retry((await rows())[0].delivery_id)).rejects.toThrow();
});
it('retains verified evidence arriving before acknowledgement and never downgrades failure', async () => {
  const id = randomUUID();
  await broadcast();
  send.mockImplementationOnce(async () => {
    await deliveries.recordProviderEvent(id, 'delivered');
    return id;
  });
  await deliveries.processDue();
  expect((await rows())[0].status).toBe('delivered');
  await deliveries.recordProviderEvent(id, 'failed');
  await deliveries.recordProviderEvent(id, 'delivered');
  expect((await rows())[0].status).toBe('failed');
  await expect(deliveries.retry((await rows())[0].delivery_id)).rejects.toThrow();
});
it('records provider suppression separately and allows manual follow-up', async () => {
  await broadcast();
  await deliveries.processDue();
  const row = (await rows())[0];
  await deliveries.recordProviderEvent(row.provider_id, 'suppressed');
  await deliveries.followUp(row.delivery_id, 'Contacted by phone', randomUUID());
  expect((await rows())[0]).toMatchObject({
    status: 'suppressed',
    follow_up_note: 'Contacted by phone',
  });
});
it('cancels once, suppresses stale queued cancellations and allows a new cancellation event', async () => {
  await messages.updateSession(sessionId, { status: SessionStatus.CANCELLED });
  await messages.updateSession(sessionId, { status: SessionStatus.CANCELLED });
  expect(await rows()).toHaveLength(1);
  await messages.updateSession(sessionId, { status: SessionStatus.SCHEDULED });
  await deliveries.processDue();
  expect(send).not.toHaveBeenCalled();
  expect((await rows())[0].status).toBe('suppressed');
  await messages.updateSession(sessionId, { status: SessionStatus.CANCELLED });
  expect(await rows()).toHaveLength(2);
  await deliveries.processDue();
  expect(send).toHaveBeenCalledTimes(1);
});
it('rolls back a cancellation if enqueue fails and suppresses changed recipients', async () => {
  const enqueue = jest
    .spyOn(deliveries, 'enqueue')
    .mockRejectedValueOnce(new Error('storage failed'));
  await expect(
    messages.updateSession(sessionId, { status: SessionStatus.CANCELLED }),
  ).rejects.toThrow();
  enqueue.mockRestore();
  expect((await db.getRepository(Session).findOneByOrFail({ session_id: sessionId })).status).toBe(
    'scheduled',
  );
  await broadcast();
  await db.query(
    "UPDATE families SET primary_contact_email='changed@example.test' WHERE family_id=$1",
    [family],
  );
  await deliveries.processDue();
  expect(send).not.toHaveBeenCalled();
  expect((await rows())[0].status).toBe('suppressed');
});
it('queues cancellations made through recurring timetable edits', async () => {
  const timetable = new TimetableService(db, tenant, messages);
  const input = {
    name: 'Test term',
    start_date: '2027-03-01',
    end_date: '2027-03-31',
    series: [
      {
        squad_id: squad,
        session_name: 'Weekly test',
        weekday: 1,
        start_time: '17:00',
        end_time: '18:00',
        excluded_dates: [],
      },
    ],
  };
  const preview = await timetable.preview(input);
  await timetable.commit({
    ...input,
    operation_id: randomUUID(),
    preview_token: preview.preview_token,
  });
  const [session] = await db.query(
    'SELECT * FROM sessions WHERE club_id=$1 AND series_id IS NOT NULL ORDER BY session_date',
    [club],
  );
  await timetable.editOne(session.session_id, { status: SessionStatus.CANCELLED });
  expect((await rows())[0]).toMatchObject({
    source_type: 'session_cancellation',
    source_id: session.session_id,
    status: 'queued',
  });
});
it('shows missing provider configuration as failed and safely retries after configuration', async () => {
  const message = await broadcast();
  const unavailable = new NotificationDeliveriesService(
    db,
    { isConfigured: () => false } as EmailService,
    tenant,
  );
  await unavailable.processDue();
  const [row] = await rows();
  expect(row.status).toBe('failed');
  expect(row.first_attempt_at).toBeNull();
  expect((await deliveries.list('broadcast', message.communication_id))[0].retryable).toBe(true);
  await deliveries.retry(row.delivery_id);
  await deliveries.processDue();
  expect((await rows())[0].status).toBe('provider_accepted');
});
it('retains acceptance evidence when a session is reinstated during the provider request', async () => {
  await messages.updateSession(sessionId, { status: SessionStatus.CANCELLED });
  send.mockImplementationOnce(async () => {
    await messages.updateSession(sessionId, { status: SessionStatus.SCHEDULED });
    return randomUUID();
  });
  await deliveries.processDue();
  expect((await rows())[0].status).toBe('provider_accepted');
  await deliveries.processDue();
  expect(send).toHaveBeenCalledTimes(1);
});

it('cannot reassign a session tenant and preserves the existing squad response', async () => {
  const result = await messages.updateSession(sessionId, {
    status: SessionStatus.SCHEDULED,
    club_id: otherClub,
  } as never);
  expect(result.club_id).toBe(club);
  expect(result.squad?.squad_id).toBe(squad);
  const foreignSquad = randomUUID();
  await db.query("INSERT INTO squads(squad_id,club_id,squad_name) VALUES($1,$2,'Other')", [
    foreignSquad,
    otherClub,
  ]);
  await expect(messages.updateSession(sessionId, { squad_id: foreignSquad })).rejects.toThrow(
    'Squad not found',
  );
});
