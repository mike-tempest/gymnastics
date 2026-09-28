import 'reflect-metadata';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AwardSkillsService } from '../modules/awards/award-skills.service';
import { AwardBillingService } from '../modules/awards/award-billing.service';
import { InvoicesService } from '../modules/finance/invoices/invoices.service';
import { TenantContextService } from '../common/tenancy/tenant-context.service';

const db = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: 55462,
  username: 'tumblebase_test',
  password: 'tumblebase_test',
  database: 'tumblebase_awards_test',
  entities: [join(__dirname, '../**/*.entity.ts')],
  migrations: [join(__dirname, '../database/migrations/*.ts')],
  synchronize: false,
});
let club: string,
  other: string,
  family: string,
  member: string,
  foreignMember: string,
  level: string,
  scheme: string,
  user: string,
  squad: string,
  session: string,
  criterion: string;
let skills: AwardSkillsService, billing: AwardBillingService, invoices: InvoicesService;
const dispatch = jest.fn();
beforeAll(async () => {
  await db.initialize();
  await db.runMigrations();
  await db.undoLastMigration();
  expect((await db.query("SELECT to_regclass('award_criteria') AS name"))[0].name).toBeNull();
  await db.runMigrations();
});
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  [club, other, family, member, foreignMember, level, scheme, user, squad, session] = Array.from(
    { length: 10 },
    () => randomUUID(),
  );
  await db.query(
    "INSERT INTO clubs(id,name,slug,tax_rate,tax_inclusive) VALUES($1::uuid,'Test',$1::text,20,false),($2::uuid,'Other',$2::text,NULL,false)",
    [club, other],
  );
  await db.query(
    "INSERT INTO families(family_id,club_id,family_name,primary_contact_name,primary_contact_email) VALUES($1,$2,'Test Family','Test Parent','controlled@example.test')",
    [family, club],
  );
  await db.query(
    "INSERT INTO squads(squad_id,club_id,squad_name,max_capacity) VALUES($1,$2,'Test class',30)",
    [squad, club],
  );
  await db.query(
    "INSERT INTO members(member_id,club_id,family_id,squad_id,first_name,last_name,dob,gender) VALUES($1,$2,$3,$4,'Test','Child','2016-01-01','female'),($5,$6,NULL,NULL,'Other','Child','2016-01-01','female')",
    [member, club, family, squad, foreignMember, other],
  );
  await db.query(
    "INSERT INTO users(user_id,club_id,email,password_hash,first_name,last_name,role) VALUES($1::uuid,$2,$1::text||'@example.test','not-a-password','Test','Coach','head_coach')",
    [user, club],
  );
  await db.query(
    "INSERT INTO award_schemes(scheme_id,club_id,name,source) VALUES($1,$2,'Test scheme','custom')",
    [scheme, club],
  );
  await db.query(
    "INSERT INTO award_levels(level_id,club_id,scheme_id,name,badge_fee,certificate_fee) VALUES($1,$2,$3,'Test badge',5,1)",
    [level, club, scheme],
  );
  await db.query(
    "INSERT INTO sessions(session_id,club_id,squad_id,session_name,session_date,start_time,end_time,status) VALUES($1,$2,$3,'Test class','2026-09-19','16:00','17:00','scheduled')",
    [session, club, squad],
  );
  const tenant = { getClubId: () => club } as TenantContextService;
  skills = new AwardSkillsService(db, tenant);
  // Real transactional invoice persistence; external delivery is stubbed only.
  invoices = Object.create(InvoicesService.prototype) as InvoicesService;
  Object.assign(invoices, { tenantContext: tenant, dispatchCreated: dispatch });
  dispatch.mockReset().mockResolvedValue(undefined);
  billing = new AwardBillingService(db, tenant, skills, invoices);
  criterion = (
    await skills.createCriterion(level, {
      name: 'Club balance',
      guidance: 'Club-authored test criterion',
    })
  ).criterion_id;
});
const assessment = () => ({
  request_key: randomUUID(),
  level_id: level,
  session_id: session,
  assessed_on: '2026-09-19',
  results: [
    {
      member_id: member,
      criterion_id: criterion,
      expected_version: 0,
      criterion_version: 1,
      status: 'achieved',
      internal_note: 'Staff only',
      parent_note: 'Well done',
    },
  ],
});
const award = () => ({
  request_key: randomUUID(),
  level_id: level,
  assessed_at: '2026-09-19',
  outcomes: [{ member_id: member, outcome: 'awarded' }],
});
const count = async (table: string) =>
  Number((await db.query(`SELECT count(*) FROM ${table} WHERE club_id=$1`, [club]))[0].count);

it('records progress and immutable snapshots without awarding or billing; parent projection excludes staff notes', async () => {
  await skills.assess(assessment(), user);
  expect(await count('invoices')).toBe(0);
  expect(
    (await db.query('SELECT status FROM member_award_progress WHERE club_id=$1', [club]))[0].status,
  ).toBe('working_towards');
  await skills.updateCriterion(criterion, { version: 1, name: 'Renamed balance', active: false });
  const history = await skills.history(member, level);
  expect(history[0]).toMatchObject({
    criterion_name: 'Club balance',
    internal_note: 'Staff only',
    parent_note: 'Well done',
    progress_version: 1,
  });
  const parent = await skills.parentProgress(member);
  expect(parent[0]).toMatchObject({ status: 'achieved', active: false, parent_note: 'Well done' });
  expect(JSON.stringify(parent)).not.toContain('Staff only');
  await expect(
    db.query('UPDATE award_skill_assessments SET parent_note=$1 WHERE club_id=$2', [
      'changed',
      club,
    ]),
  ).rejects.toThrow('immutable');
});
it('replays the same request once and rejects changed payloads and stale concurrent results', async () => {
  const request = assessment();
  const results = await Promise.all([skills.assess(request, user), skills.assess(request, user)]);
  expect(results[0]).toEqual(results[1]);
  expect(await count('award_skill_assessments')).toBe(1);
  await expect(skills.assess({ ...request, assessed_on: '2026-09-18' }, user)).rejects.toThrow(
    'Request key',
  );
  await expect(skills.assess(assessment(), user)).rejects.toThrow('Another assessor');
  const fresh = assessment();
  fresh.results[0].expected_version = 1;
  fresh.results[0].status = 'working_towards';
  await skills.assess(fresh, user);
  expect(await count('award_skill_assessments')).toBe(2);
});
it('rejects stale criteria and rolls back every result when one selected member is foreign', async () => {
  const request = assessment();
  request.results.push({ ...request.results[0], member_id: foreignMember });
  await expect(skills.assess(request, user)).rejects.toThrow('register');
  expect(await count('award_skill_progress')).toBe(0);
  await skills.updateCriterion(criterion, { version: 1, guidance: 'New guidance' });
  await expect(skills.assess(assessment(), user)).rejects.toThrow('Criterion changed');
});
it('uses the session register including earlier attendance, and rejects cancelled sessions', async () => {
  await db.query(
    "INSERT INTO attendance(club_id,session_id,member_id,status) VALUES($1,$2,$3,'present')",
    [club, session, member],
  );
  await db.query('UPDATE members SET squad_id=NULL WHERE member_id=$1', [member]);
  expect(
    (await skills.assessmentContext(level, session)).members.map(
      (m: { member_id: string }) => m.member_id,
    ),
  ).toEqual([member]);
  await db.query("UPDATE sessions SET status='cancelled' WHERE session_id=$1", [session]);
  await expect(skills.assess(assessment(), user)).rejects.toThrow('cancelled');
});
it('requires explicit fee confirmation and applies the same tax as ordinary invoices', async () => {
  await billing.record(award(), user);
  expect(await count('invoices')).toBe(0);
  const preview = await billing.preview({ level_id: level, member_ids: [member] });
  expect(preview.rows[0]).toMatchObject({
    subtotal: 6,
    tax_amount: 1.2,
    total_amount: 7.2,
    family_name: 'Test Family',
  });
  await expect(billing.record({ ...award(), bill_fees: true }, user)).rejects.toThrow('preview');
  await billing.record({ ...award(), bill_fees: true, fee_preview_hash: preview.hash }, user);
  const [invoice] = await db.query(
    'SELECT subtotal,tax_amount,total_amount,currency FROM invoices WHERE club_id=$1',
    [club],
  );
  expect(Number(invoice.total_amount)).toBe(7.2);
  expect(Number(invoice.tax_amount)).toBe(1.2);
  expect(invoice.currency).toBe('GBP');
  expect(dispatch).toHaveBeenCalledTimes(1);
});
it('concurrent identical charged requests create one invoice and dispatch once', async () => {
  const preview = await billing.preview({ level_id: level, member_ids: [member] });
  const request = { ...award(), bill_fees: true, fee_preview_hash: preview.hash };
  const replies = await Promise.all([billing.record(request, user), billing.record(request, user)]);
  expect(replies[0]).toEqual(replies[1]);
  expect(await count('invoices')).toBe(1);
  expect(await count('award_invoice_sources')).toBe(1);
  expect(dispatch).toHaveBeenCalledTimes(1);
  const fresh = await billing.preview({ level_id: level, member_ids: [member] });
  expect(fresh.rows[0].reason).toBe('already_invoiced');
  await billing.record({ ...award(), bill_fees: true, fee_preview_hash: fresh.hash }, user);
  expect(await count('invoices')).toBe(1);
});
it('independent concurrent requests cannot both charge the same award', async () => {
  const preview = await billing.preview({ level_id: level, member_ids: [member] });
  const results = await Promise.allSettled([
    billing.record({ ...award(), bill_fees: true, fee_preview_hash: preview.hash }, user),
    billing.record({ ...award(), bill_fees: true, fee_preview_hash: preview.hash }, user),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
  expect(await count('invoices')).toBe(1);
});
it('rejects stale pricing and rolls back invoice, event and source on a persistence failure', async () => {
  const preview = await billing.preview({ level_id: level, member_ids: [member] });
  await skills.updateLevel(level, { badge_fee: 7 });
  await expect(
    billing.record({ ...award(), bill_fees: true, fee_preview_hash: preview.hash }, user),
  ).rejects.toThrow('changed');
  const fresh = await billing.preview({ level_id: level, member_ids: [member] });
  const original = invoices.createInTransaction.bind(invoices);
  jest.spyOn(invoices, 'createInTransaction').mockImplementationOnce(async (dto, em) => {
    await original(dto, em);
    throw new Error('injected persistence failure');
  });
  await expect(
    billing.record({ ...award(), bill_fees: true, fee_preview_hash: fresh.hash }, user),
  ).rejects.toThrow('injected');
  expect(await count('invoices')).toBe(0);
  expect(await count('award_assessment_events')).toBe(0);
  expect(await count('award_invoice_sources')).toBe(0);
  expect(dispatch).not.toHaveBeenCalled();
});
it('retains a committed invoice after a lost response and never charges again on replay', async () => {
  const preview = await billing.preview({ level_id: level, member_ids: [member] });
  const request = { ...award(), bill_fees: true, fee_preview_hash: preview.hash };
  dispatch.mockRejectedValueOnce(new Error('lost response'));
  await expect(billing.record(request, user)).rejects.toThrow('lost response');
  expect((await billing.record(request, user)).invoices_raised).toBe(1);
  expect(await count('invoices')).toBe(1);
  expect(dispatch).toHaveBeenCalledTimes(1);
});
it('keeps awards when fees cannot be billed, including missing families and zero fees', async () => {
  await db.query('UPDATE members SET family_id=NULL WHERE member_id=$1', [member]);
  const preview = await billing.preview({ level_id: level, member_ids: [member] });
  const result = await billing.record(
    { ...award(), bill_fees: true, fee_preview_hash: preview.hash },
    user,
  );
  expect(result.awarded).toBe(1);
  expect(result.warnings).toHaveLength(1);
  expect(await count('invoices')).toBe(0);
});
it('rejects cycles, including cycles caused by reordered implicit progression', async () => {
  const next = randomUUID();
  await db.query(
    "INSERT INTO award_levels(level_id,club_id,scheme_id,name,sort_order) VALUES($1,$2,$3,'Next',2)",
    [next, club, scheme],
  );
  await expect(skills.setProgression(next, { next_level_id: level })).rejects.toThrow('cycle');
  await skills.setProgression(level, { next_level_id: next });
  await expect(skills.updateLevel(level, { sort_order: 3 })).rejects.toThrow('cycle');
});
it('scopes criteria, sessions, member history, progress, invoices and request keys to the club', async () => {
  const tenant = { getClubId: () => other } as TenantContextService;
  const foreign = new AwardSkillsService(db, tenant);
  const foreignBilling = new AwardBillingService(db, tenant, foreign, invoices);
  await expect(foreign.criteria(level)).rejects.toThrow('not found');
  await expect(
    foreign.updateCriterion(criterion, { version: 1, name: 'Wrong club' }),
  ).rejects.toThrow('not found');
  await expect(foreign.history(member, level)).rejects.toThrow('not found');
  expect(await foreign.parentProgress(member)).toEqual([]);
  await expect(skills.assessmentContext(level, randomUUID())).rejects.toThrow('Session');
  await expect(foreignBilling.preview({ level_id: level, member_ids: [member] })).rejects.toThrow(
    'not found',
  );
  await expect(billing.preview({ level_id: level, member_ids: [foreignMember] })).rejects.toThrow(
    'not found',
  );
  await expect(billing.record(award(), randomUUID())).rejects.toThrow('Assessor');
});

it('shows badge completion separately and adopts existing invoice links when migrating', async () => {
  const preview = await billing.preview({ level_id: level, member_ids: [member] });
  await billing.record({ ...award(), bill_fees: true, fee_preview_hash: preview.hash }, user);
  const context = await skills.assessmentContext(level, session);
  expect(context.level_progress[0]).toMatchObject({
    member_id: member,
    status: 'awarded',
    awarded_on: '2026-09-19',
    has_invoice: true,
  });
  await db.undoLastMigration();
  await db.runMigrations();
  const adopted = await billing.preview({ level_id: level, member_ids: [member] });
  expect(adopted.rows[0].reason).toBe('already_invoiced');
  await billing.record({ ...award(), bill_fees: true, fee_preview_hash: adopted.hash }, user);
  expect(await count('invoices')).toBe(1);
});
