import { OperationalMessagesService } from '../notification-deliveries/operational-messages.service';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { TimetableService } from './timetable.service';
import { TimetableDto } from './dto/timetable.dto';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { Session } from './entities/session.entity';
import { Squad } from '../squads/entities/squad.entity';
import { Member } from '../members/entities/member.entity';
import { Family } from '../families/entities/family.entity';

const connectionUrl = process.env.TEM56_TEST_DATABASE_URL;
const suite = connectionUrl ? describe : describe.skip;
suite('Timetable PostgreSQL tenant isolation, history and concurrency', () => {
  let db: DataSource;
  let service: TimetableService;
  let other: TimetableService;
  let club: string;
  let clubB: string;
  let squad: string;
  let member: string;
  let input: TimetableDto;
  beforeAll(async () => {
    const url = new URL(connectionUrl!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/tumblebase_tem55')
      throw new Error('Use the migrated disposable local test database');
    db = await new DataSource({
      type: 'postgres',
      url: connectionUrl,
      entities: [Session, Squad, Member, Family],
      synchronize: false,
    }).initialize();
  });
  beforeEach(async () => {
    club = randomUUID();
    clubB = randomUUID();
    squad = randomUUID();
    member = randomUUID();
    await db.query(
      "INSERT INTO clubs(id,name,slug,timezone) VALUES ($1::uuid,'Timetable A',$1::text,'Europe/London'),($2::uuid,'Timetable B',$2::text,'Europe/London')",
      [club, clubB],
    );
    await db.query(
      "INSERT INTO squads(squad_id,club_id,squad_name,max_capacity) VALUES ($1,$2,'Recreational',2)",
      [squad, club],
    );
    await db.query(
      "INSERT INTO members(member_id,club_id,squad_id,first_name,last_name,dob,gender) VALUES ($1,$2,$3,'Test','Gymnast','2015-01-01','female')",
      [member, club, squad],
    );
    service = new TimetableService(
      db,
      { getClubId: () => club } as TenantContextService,
      { sessionChanged: jest.fn() } as unknown as OperationalMessagesService,
    );
    other = new TimetableService(
      db,
      { getClubId: () => clubB } as TenantContextService,
      { sessionChanged: jest.fn() } as unknown as OperationalMessagesService,
    );
    jest
      .spyOn(service as unknown as { now: () => Date }, 'now')
      .mockReturnValue(new Date('2026-09-16T12:00:00Z'));
    input = {
      name: 'Spring',
      start_date: '2027-03-01',
      end_date: '2027-03-31',
      series: [
        {
          squad_id: squad,
          session_name: 'Weekly training',
          weekday: 1,
          start_time: '17:00',
          end_time: '18:00',
          excluded_dates: ['2027-03-15'],
        },
      ],
    };
  });
  afterEach(async () => {
    if (!club) return;
    await db.query('DELETE FROM attendance WHERE club_id IN ($1,$2)', [club, clubB]);
    await db.query('DELETE FROM sessions WHERE club_id IN ($1,$2)', [club, clubB]);
    await db.query('DELETE FROM timetable_operations WHERE club_id IN ($1,$2)', [club, clubB]);
    await db.query('DELETE FROM session_series WHERE club_id IN ($1,$2)', [club, clubB]);
    await db.query('DELETE FROM timetable_terms WHERE club_id IN ($1,$2)', [club, clubB]);
    await db.query('DELETE FROM members WHERE club_id IN ($1,$2)', [club, clubB]);
    await db.query('DELETE FROM squads WHERE club_id IN ($1,$2)', [club, clubB]);
    await db.query('DELETE FROM clubs WHERE id IN ($1,$2)', [club, clubB]);
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  async function save(dto = input) {
    const preview = await service.preview(dto);
    return service.commit({
      ...dto,
      operation_id: randomUUID(),
      preview_token: preview.preview_token,
    });
  }
  const sessions = () =>
    db.getRepository(Session).find({ where: { club_id: club }, order: { occurrence_date: 'ASC' } });

  it('materialises dated register sessions with holidays retained as cancelled', async () => {
    const preview = await service.preview(input);
    expect(preview.rows[0]).toMatchObject({ occupied: 1, places: 1, capacity: 2 });
    expect(preview.rows[0].scheduled).toHaveLength(4);
    await save();
    const rows = await sessions();
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.squad_id === squad && row.start_time === '17:00:00')).toBe(true);
    expect(rows[2]).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'Holiday or club closure',
      occurrence_date: '2027-03-15',
    });
    expect(
      (await db.query('SELECT squad_id FROM members WHERE member_id=$1', [member]))[0].squad_id,
    ).toBe(squad);
  });
  it('rejects foreign squads, terms and occurrences without exposing another club', async () => {
    await expect(other.preview(input)).rejects.toThrow('Squad not found');
    const created = await save();
    expect(await other.list()).toEqual([]);
    await expect(
      other.preview({
        ...input,
        source_term_id: created.term_id,
        start_date: '2027-04-01',
        end_date: '2027-04-30',
      }),
    ).rejects.toThrow('Term not found');
    await expect(
      other.edit((await sessions())[0].session_id, { scope: 'one', definition: input.series[0] }),
    ).rejects.toThrow('not found');
  });
  it('revalidates current membership and capacity after a preview', async () => {
    const preview = await service.preview(input);
    await db.query('UPDATE squads SET max_capacity=0 WHERE squad_id=$1', [squad]);
    await expect(
      service.commit({
        ...input,
        operation_id: randomUUID(),
        preview_token: preview.preview_token,
      }),
    ).rejects.toThrow('changed');
    const current = await service.preview(input);
    expect(current.can_commit).toBe(false);
    await expect(
      service.commit({
        ...input,
        operation_id: randomUUID(),
        preview_token: current.preview_token,
      }),
    ).rejects.toThrow('capacity');
    expect(await sessions()).toHaveLength(0);
  });
  it('serialises repeated concurrent creates and rejects reuse with different input', async () => {
    const preview = await service.preview(input);
    const request = { ...input, operation_id: randomUUID(), preview_token: preview.preview_token };
    const results = await Promise.all([service.commit(request), service.commit(request)]);
    expect(results[0]).toEqual(results[1]);
    expect(await sessions()).toHaveLength(5);
    await expect(service.commit({ ...request, name: 'Different' })).rejects.toThrow(
      'different timetable',
    );
  });
  it('rolls over once even with different operation references, and does not copy old holidays', async () => {
    const created = await save();
    const source = (await service.list())[0];
    const next = {
      name: 'Summer',
      start_date: '2027-04-01',
      end_date: '2027-04-30',
      source_term_id: created.term_id,
      series: source.series.map((s) => ({ ...s.definition, excluded_dates: [] })),
    };
    const preview = await service.preview(next);
    const results = await Promise.all([
      service.commit({ ...next, preview_token: preview.preview_token, operation_id: randomUUID() }),
      service.commit({ ...next, preview_token: preview.preview_token, operation_id: randomUUID() }),
    ]);
    expect(results[0].term_id).toBe(results[1].term_id);
    expect(await service.list()).toHaveLength(2);
    expect(await sessions()).toHaveLength(9);
  });
  it('preserves individual overrides, started sessions and attendance during future edits', async () => {
    await save();
    let rows = await sessions();
    await service.edit(rows[1].session_id, {
      scope: 'one',
      definition: { ...input.series[0], start_time: '16:00' },
      session_date: '2027-03-09',
    });
    await db.query(
      "INSERT INTO attendance(club_id,session_id,member_id,status) VALUES($1,$2,$3,'present')",
      [club, rows[0].session_id, member],
    );
    await db.query("UPDATE sessions SET status='in_progress' WHERE session_id=$1", [
      rows[3].session_id,
    ]);
    const result = await service.edit(rows[0].session_id, {
      scope: 'future',
      definition: { ...input.series[0], start_time: '15:00', excluded_dates: ['2027-03-29'] },
    });
    expect(result.updated).toBe(2);
    expect(result.skipped).toHaveLength(3);
    const originalIds = rows.map((row) => row.session_id);
    rows = await sessions();
    expect(rows.map((row) => row.session_id)).toEqual(originalIds);
    expect(rows[0].start_time).toBe('17:00:00');
    expect(rows[1]).toMatchObject({
      session_date: '2027-03-09',
      occurrence_date: '2027-03-08',
      start_time: '16:00:00',
      is_override: true,
    });
    expect(rows[2].status).toBe('scheduled');
    expect(rows[4].status).toBe('cancelled');
    await expect(
      service.edit(rows[0].session_id, { scope: 'one', definition: input.series[0] }),
    ).rejects.toThrow('attendance');
  });
  it('protects past history and rejects moving a future session into the past', async () => {
    await save();
    const rows = await sessions();
    jest
      .spyOn(service as unknown as { now: () => Date }, 'now')
      .mockReturnValue(new Date('2027-03-10T12:00:00Z'));
    const result = await service.edit(rows[0].session_id, {
      scope: 'future',
      definition: { ...input.series[0], start_time: '16:00' },
    });
    expect(result.skipped).toHaveLength(2);
    await expect(
      service.edit(rows[4].session_id, {
        scope: 'one',
        definition: input.series[0],
        session_date: '2027-03-02',
      }),
    ).rejects.toThrow('future');
  });
});
