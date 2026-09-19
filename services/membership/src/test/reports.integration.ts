import 'reflect-metadata';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { OperationalReportsService, reportCsv } from '../modules/admin/operational-reports.service';
import { TenantContextService } from '../common/tenancy/tenant-context.service';

const db = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: 55473,
  username: 'tumblebase_test',
  password: 'tumblebase_test',
  database: 'tumblebase_reports_test',
  entities: [join(__dirname, '../**/*.entity.ts')],
  migrations: [join(__dirname, '../database/migrations/*.ts')],
  synchronize: false,
});
let club: string,
  other: string,
  small: string,
  large: string,
  unknown: string,
  foreign: string,
  family: string,
  entry: string;
let service: OperationalReportsService;
const period = { from: '2026-09-01', to: '2026-09-30' };
beforeAll(async () => {
  await db.initialize();
  await db.runMigrations();
});
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  [club, other, small, large, unknown, foreign, family, entry] = Array.from({ length: 8 }, () =>
    randomUUID(),
  );
  await db.query(
    "INSERT INTO clubs(id,name,slug,timezone) VALUES($1::uuid,'Test',$1::text,'Europe/London'),($2::uuid,'Other',$2::text,'Europe/London')",
    [club, other],
  );
  await db.query(
    "INSERT INTO squads(squad_id,club_id,squad_name,max_capacity,discipline) VALUES($1,$5,'Small',10,'WOMENS_ARTISTIC'),($2,$5,'Large',20,'MENS_ARTISTIC'),($3,$5,'Unknown',NULL,NULL),($4,$6,'Foreign',100,'WOMENS_ARTISTIC')",
    [small, large, unknown, foreign, club, other],
  );
  for (const [squad, count, owner] of [
    [small, 9, club],
    [large, 10, club],
    [unknown, 2, club],
    [foreign, 90, other],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const member = randomUUID();
      await db.query(
        "INSERT INTO members(member_id,club_id,squad_id,first_name,last_name,dob,gender) VALUES($1,$2,$3,'Synthetic','Gymnast','2016-01-01','female')",
        [member, owner, squad],
      );
      await db.query('INSERT INTO squad_members(squad_id,member_id) VALUES($1,$2)', [
        squad,
        member,
      ]);
    }
  }
  await db.query(
    "INSERT INTO families(family_id,club_id,family_name,primary_contact_name,primary_contact_email) VALUES($1,$2,'Test Family','Test Parent','controlled@example.test')",
    [family, club],
  );
  await db.query(
    "INSERT INTO waiting_list_entries(entry_id,club_id,child_first_name,child_last_name,child_dob,parent_name,parent_email) VALUES($1,$2,'Private','Child','2016-01-01','Private Parent','private@example.test')",
    [entry, club],
  );
  service = new OperationalReportsService(db, { getClubId: () => club } as TenantContextService);
});
async function offer(status: string, time = '2026-09-10T12:00:00Z') {
  await db.query(
    "INSERT INTO waiting_list_offers(club_id,entry_id,squad_id,status,offered_at,expires_at,accept_token) VALUES($1,$2,$3,$4,$5,'2026-10-01', $6)",
    [club, entry, small, status, time, randomUUID()],
  );
}
async function invoice(amount: string, currency = 'GBP', status = 'sent') {
  const id = randomUUID();
  await db.query(
    "INSERT INTO invoices(invoice_id,club_id,family_id,invoice_number,total_amount,currency,status,issued_date,due_date) VALUES($1::uuid,$2,$3,$1::text,$4,$5,$6,'2026-09-10','2026-09-20')",
    [id, club, family, amount, currency, status],
  );
  return id;
}
it('weights occupancy by capacity, excludes unknown capacity, and never double-counts the primary class', async () => {
  await offer('pending');
  const result = await service.summary(period);
  expect(result.occupancy).toMatchObject({
    assigned: 19,
    capacity: 30,
    rate_percent: 63.33,
    reserved: 1,
    unknown_capacity_classes: 1,
    assigned_without_capacity: 2,
    class_count: 3,
  });
  const detail = await service.details({ ...period, metric: 'occupancy' });
  expect(detail.total).toBe(3);
  expect(detail.rows.some((r) => r.id === foreign)).toBe(false);
  expect((await service.export({ ...period, metric: 'occupancy' })).split('\r\n')).toHaveLength(5);
});
it('distinguishes issued-cohort and resolved acceptance with pending and withdrawn offers', async () => {
  for (const status of [
    'accepted',
    'accepted',
    'accepted',
    'accepted',
    'declined',
    'expired',
    'pending',
    'pending',
    'withdrawn',
    'withdrawn',
  ])
    await offer(status);
  const result = await service.summary(period);
  expect(result.offers).toMatchObject({
    issued: 10,
    accepted: 4,
    resolved: 6,
    pending: 2,
    withdrawn: 2,
    rate_percent: 40,
    resolved_rate_percent: 66.67,
  });
  const detail = await service.details({ ...period, metric: 'offers' });
  expect(detail.total).toBe(result.offers.issued);
  const csv = await service.export({ ...period, metric: 'offers' });
  expect(csv.split('\r\n')).toHaveLength(12);
  expect(csv).not.toContain('private@example.test');
  expect(csv).not.toContain('accept_token');
});
it('uses club-local midnight across the daylight-saving boundary', async () => {
  for (const time of [
    '2026-03-28T23:59:59Z',
    '2026-03-29T00:00:00Z',
    '2026-03-29T22:59:59Z',
    '2026-03-29T23:00:00Z',
  ])
    await offer('accepted', time);
  expect((await service.summary({ from: '2026-03-29', to: '2026-03-29' })).offers.issued).toBe(2);
});
it('keeps currencies separate and counts only confirmed collections without floating-point drift', async () => {
  const id = await invoice('10.10');
  await invoice('0.20');
  await invoice('7.30', 'AUD');
  await invoice('90', 'GBP', 'draft');
  await invoice('80', 'GBP', 'cancelled');
  for (const [amount, status] of [
    ['0.10', 'confirmed'],
    ['0.20', 'confirmed'],
    ['80', 'failed'],
    ['70', 'submitted'],
  ])
    await db.query(
      "INSERT INTO payments(club_id,invoice_id,amount,status,payment_date) VALUES($1,$2,$3,$4,'2026-09-10')",
      [club, id, amount, status],
    );
  const result = await service.summary(period);
  expect(result.invoiced).toMatchObject({
    status: 'available',
    totals: [
      { currency: 'AUD', minor_units: '730', count: 1 },
      { currency: 'GBP', minor_units: '1030', count: 2 },
    ],
  });
  expect(result.collected).toMatchObject({
    status: 'available',
    totals: [{ currency: 'GBP', minor_units: '30', count: 2 }],
  });
  const records = await service.details({ ...period, metric: 'collected' });
  expect(records.total).toBe(2);
  expect(records.rows.reduce((sum, r) => sum + Number(r.minor_units), 0)).toBe(30);
});
it('applies class and discipline filters and refuses misleading class finance totals', async () => {
  const result = await service.summary({ ...period, discipline: 'WOMENS_ARTISTIC' });
  expect(result.occupancy).toMatchObject({
    assigned: 9,
    capacity: 10,
    class_count: 1,
    rate_percent: 90,
  });
  expect(result.invoiced.status).toBe('unavailable');
  await expect(
    service.details({ ...period, squad_id: small, metric: 'collected' }),
  ).rejects.toThrow('Class allocation');
  await expect(
    service.export({ ...period, discipline: 'WOMENS_ARTISTIC', metric: 'invoiced' }),
  ).rejects.toThrow('Class allocation');
});
it('rejects foreign classes, injected club scopes, invalid dates and unbounded ranges', async () => {
  await expect(service.summary({ ...period, squad_id: foreign })).rejects.toThrow(
    'Class not found',
  );
  await expect(service.summary({ ...period, club_id: other })).rejects.toThrow('valid dates');
  await expect(service.summary({ from: '2026-02-30' })).rejects.toThrow('valid dates');
  await expect(service.summary({ from: '2020-01-01', to: '2026-09-19' })).rejects.toThrow(
    '367 days',
  );
});
it('returns null rates for empty denominators and explicitly unavailable history', async () => {
  const result = await service.summary({ ...period, squad_id: unknown });
  expect(result.occupancy.rate_percent).toBeNull();
  expect(result.offers.rate_percent).toBeNull();
  expect(result.offers.resolved_rate_percent).toBeNull();
  expect(result.unavailable.find((r) => r.id === 'retention')).toMatchObject({
    status: 'unavailable',
    first_supported_date: null,
  });
});
it('escapes spreadsheet formulae and quoted fields', () => {
  const csv = reportCsv([
    { id: '1', label: ' =HYPERLINK("evil")', detail: 'line\n"quoted"', href: '/unused' },
  ]);
  expect(csv).toContain('"\' =HYPERLINK(""evil"")"');
  expect(csv).toContain('"line\n""quoted"""');
});
