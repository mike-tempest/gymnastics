import 'reflect-metadata';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { SearchService } from '../modules/search/search.service';
import { TenantContextService } from '../common/tenancy/tenant-context.service';
import { UserRole } from '../modules/users/entities/user.entity';

const db = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: 55465,
  username: 'tumblebase_test',
  password: 'tumblebase_test',
  database: 'tumblebase_batch',
  entities: [join(__dirname, '../**/*.entity.ts')],
  migrations: [join(__dirname, '../database/migrations/*.ts')],
  synchronize: false,
});
const club = randomUUID();
const otherClub = randomUUID();
const family = randomUUID();
const otherFamily = randomUUID();
const squad = randomUUID();
let service: SearchService;
beforeAll(async () => {
  await db.initialize();
  await db.runMigrations();
  await db.query(
    'INSERT INTO clubs(id,name,slug) VALUES ($1::uuid,$1::text,$1::text),($2::uuid,$2::text,$2::text)',
    [club, otherClub],
  );
  await db.query(
    "INSERT INTO families(family_id,club_id,family_name,primary_contact_name,primary_contact_email) VALUES ($1,$3,'Smith','Ada Smith','test@example.com'),($2,$3,'Smith','Other Smith','other@example.com')",
    [family, otherFamily, club],
  );
  await db.query("INSERT INTO squads(squad_id,club_id,squad_name) VALUES($1,$2,'Explore')", [
    squad,
    club,
  ]);
  await db.query(
    "INSERT INTO members(club_id, family_id, squad_id, first_name,last_name,dob,gender,medical_notes) VALUES($1,$2,$3,'Ada','Smith','2016-01-01','female','NEVER EXPOSE'),($1,$4,NULL,'Ada','Smith','2015-01-01','female',NULL),($5,NULL,NULL,'Ada','Smith','2015-01-01','female',NULL)",
    [club, family, squad, otherFamily, otherClub],
  );
  await db.query(
    "INSERT INTO sessions(club_id,squad_id,session_name,session_date,start_time,end_time,status) VALUES($1,$2,'Explore Smith',CURRENT_DATE+1,'16:00','17:00','scheduled'),($3,NULL,'Explore Smith',CURRENT_DATE+1,'16:00','17:00','scheduled')",
    [club, squad, otherClub],
  );
  await db.query(
    "INSERT INTO members(club_id,first_name,last_name,dob,gender) SELECT $1, 'Scale', 'Record ' || n,'2016-01-01','female' FROM generate_series(1,5000) n",
    [club],
  );
  service = new SearchService(db, { getClubId: () => club } as TenantContextService);
});
afterAll(async () => {
  if (db.isInitialized) await db.destroy();
});
it('scopes real SQL results to the club and returns a small safe projection', async () => {
  const data = await service.search('Smith', {
    club_id: club,
    family_id: family,
    role: UserRole.SUPER_ADMIN,
  });
  expect(data.results.filter((row) => row.kind === 'member')).toHaveLength(2);
  expect(data.results.filter((row) => row.kind === 'session')).toHaveLength(1);
  expect(data.results.filter((row) => row.kind === 'family')).toHaveLength(2);
  expect(JSON.stringify(data)).not.toContain('NEVER EXPOSE');
  expect(JSON.stringify(data)).not.toContain('@example.com');
  expect(
    new Set(data.results.filter((row) => row.kind === 'member').map((row) => row.detail)).size,
  ).toBe(2);
});
it('restricts parents to their own family and enrolled sessions with parent destinations', async () => {
  const data = await service.search('Smith', {
    club_id: club,
    family_id: family,
    role: UserRole.PARENT,
  });
  expect(data.results.map((row) => row.kind).sort()).toEqual(['family', 'member', 'session']);
  expect(data.results.every((row) => row.href.startsWith('/parent/'))).toBe(true);
});
it('bounds representative club-scale results and handles literal wildcard searches', async () => {
  const start = Date.now();
  const data = await service.search('Scale', {
    club_id: club,
    family_id: family,
    role: UserRole.SUPER_ADMIN,
  });
  expect(data.results).toHaveLength(5);
  expect(data.truncated).toBe(true);
  expect(Date.now() - start).toBeLessThan(2000);
  expect(
    (await service.search('%_', { club_id: club, family_id: family, role: UserRole.SUPER_ADMIN }))
      .results,
  ).toEqual([]);
});
