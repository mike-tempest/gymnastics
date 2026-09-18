import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClsModule, ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';
import { JwtStrategy } from '../modules/auth/strategies/jwt.strategy';
import { UsersController } from '../modules/users/users.controller';
import { UsersRepository } from '../modules/users/users.repository';
import { UsersService } from '../modules/users/users.service';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { Club } from '../modules/clubs/entities/club.entity';
import { Family } from '../modules/families/entities/family.entity';
import { TenantContextService } from '../common/tenancy/tenant-context.service';
import { TenantInterceptor } from '../common/tenancy/tenant.interceptor';
import { EmailService } from '../modules/email/email.service';
import { AuditLogsService } from '../modules/compliance/audit-logs/audit-logs.service';

// Same dedicated disposable database as password-recovery.integration.ts.
// No application .env, real provider or production account is used.
const database = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: Number(process.env.RECOVERY_TEST_PORT ?? 55464),
  username: 'tumblebase_test',
  password: 'tumblebase_test',
  database: 'tumblebase_tem64',
  entities: [join(__dirname, '../**/*.entity.ts')],
  migrations: [join(__dirname, '../database/migrations/*.ts')],
  synchronize: false,
});
const jwt = new JwtService({
  secret: 'isolated-account-test-secret',
  signOptions: { expiresIn: '1h' },
});
const config = new ConfigService({ JWT_SECRET: 'isolated-account-test-secret' });
let app: INestApplication;
let clubA: Club;
let clubB: Club;
let admin: User;
let parent: User;
let foreign: User;
let welfare: User;
let foreignFamily: Family;
let adminToken: string;
let parentToken: string;

async function createUser(club: Club, role: UserRole): Promise<User> {
  return database.getRepository(User).save({
    club_id: club.id,
    email: `${randomUUID()}@example.test`,
    first_name: 'Synthetic',
    last_name: 'Test',
    role,
    active: true,
    password_hash: await bcrypt.hash('OriginalPassword123', 10),
  });
}
async function login(user: User, password = 'OriginalPassword123'): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: user.email, password })
    .expect(201);
  return response.body.access_token;
}

beforeAll(async () => {
  await database.initialize();
  await database.runMigrations();
  clubA = await database
    .getRepository(Club)
    .save({ name: 'Account access A', slug: `access-a-${randomUUID()}` });
  clubB = await database
    .getRepository(Club)
    .save({ name: 'Account access B', slug: `access-b-${randomUUID()}` });
  admin = await createUser(clubA, UserRole.SUPER_ADMIN);
  parent = await createUser(clubA, UserRole.PARENT);
  welfare = await createUser(clubA, UserRole.WELFARE_OFFICER);
  foreign = await createUser(clubB, UserRole.PARENT);
  foreignFamily = await database.getRepository(Family).save({
    club_id: clubB.id,
    family_name: 'Foreign synthetic family',
    primary_contact_name: 'Synthetic',
    primary_contact_email: `${randomUUID()}@example.test`,
  });
  const module = await Test.createTestingModule({
    imports: [ClsModule.forRoot({ global: true, middleware: { mount: true } })],
    controllers: [AuthController, UsersController],
    providers: [
      TenantContextService,
      UsersService,
      {
        provide: UsersRepository,
        useFactory: (tenant: TenantContextService) =>
          new UsersRepository(database.getRepository(User), tenant),
        inject: [TenantContextService],
      },
      {
        provide: AuthService,
        useFactory: (users: UsersService) =>
          new AuthService(
            users,
            jwt,
            {} as EmailService,
            config,
            { logLogin: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogsService,
            database,
          ),
        inject: [UsersService],
      },
      {
        provide: JwtStrategy,
        useFactory: (users: UsersService) => new JwtStrategy(config, users),
        inject: [UsersService],
      },
    ],
  }).compile();
  app = module.createNestApplication();
  app.useGlobalInterceptors(new TenantInterceptor(module.get(ClsService)));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  adminToken = await login(admin);
  parentToken = await login(parent);
});
afterAll(async () => {
  await app?.close();
  if (database.isInitialized) await database.destroy();
});

it('requires a valid authenticated account for user writes', async () => {
  await request(app.getHttpServer())
    .patch(`/users/${parent.user_id}`)
    .send({ role: UserRole.SUPER_ADMIN })
    .expect(401);
  await request(app.getHttpServer()).post('/users').send({}).expect(401);
});

it('rejects self-escalation and another account password change without writing either row', async () => {
  await request(app.getHttpServer())
    .patch(`/users/${parent.user_id}`)
    .auth(parentToken, { type: 'bearer' })
    .send({ role: UserRole.SUPER_ADMIN })
    .expect(403);
  await request(app.getHttpServer())
    .patch(`/users/${admin.user_id}`)
    .auth(parentToken, { type: 'bearer' })
    .send({ password: 'UnwantedPassword123' })
    .expect(403);
  expect(
    (await database.getRepository(User).findOneByOrFail({ user_id: parent.user_id })).role,
  ).toBe(UserRole.PARENT);
  expect(await login(admin)).toEqual(expect.any(String));
});

it('scopes administrator lists and rejects foreign account reads, edits and deletion', async () => {
  const list = await request(app.getHttpServer())
    .get('/users')
    .auth(adminToken, { type: 'bearer' })
    .expect(200);
  expect(list.body.every((row: User) => row.club_id === clubA.id)).toBe(true);
  expect(list.body.map((row: User) => row.user_id)).not.toContain(foreign.user_id);
  await request(app.getHttpServer())
    .get(`/users/${foreign.user_id}`)
    .auth(adminToken, { type: 'bearer' })
    .expect(404);
  await request(app.getHttpServer())
    .patch(`/users/${foreign.user_id}`)
    .auth(adminToken, { type: 'bearer' })
    .send({ first_name: 'Changed' })
    .expect(404);
  await request(app.getHttpServer())
    .delete(`/users/${foreign.user_id}`)
    .auth(adminToken, { type: 'bearer' })
    .expect(404);
  expect(
    (await database.getRepository(User).findOneByOrFail({ user_id: foreign.user_id })).first_name,
  ).toBe('Synthetic');
});

it('refuses foreign family reassignment even for an administrator', async () => {
  await request(app.getHttpServer())
    .patch(`/users/${parent.user_id}`)
    .auth(adminToken, { type: 'bearer' })
    .send({ family_id: foreignFamily.family_id })
    .expect(404);
  expect(
    (await database.getRepository(User).findOneByOrFail({ user_id: parent.user_id })).family_id,
  ).toBeNull();
});

it('stamps new accounts with the administrator club and rejects client tenant injection', async () => {
  const input = {
    email: `${randomUUID()}@example.test`,
    first_name: 'New',
    last_name: 'Synthetic',
    password: 'SyntheticPassword123',
    role: UserRole.HEAD_COACH,
  };
  await request(app.getHttpServer())
    .post('/users')
    .auth(adminToken, { type: 'bearer' })
    .send({ ...input, club_id: clubB.id })
    .expect(400);
  const created = await request(app.getHttpServer())
    .post('/users')
    .auth(adminToken, { type: 'bearer' })
    .send(input)
    .expect(201);
  expect(created.body.club_id).toBe(clubA.id);
  expect(created.body).not.toHaveProperty('password_hash');
});

it('reloads a revoked role, rejects inactive accounts and rejects a token for another club', async () => {
  const token = await login(welfare);
  await database.getRepository(User).update(welfare.user_id, { role: UserRole.PARENT });
  const current = await request(app.getHttpServer())
    .get('/auth/profile')
    .auth(token, { type: 'bearer' })
    .expect(200);
  expect(current.body.role).toBe(UserRole.PARENT);
  await request(app.getHttpServer())
    .post('/users')
    .auth(token, { type: 'bearer' })
    .send({})
    .expect(403);
  await database.getRepository(User).update(welfare.user_id, { active: false });
  await request(app.getHttpServer())
    .get('/auth/profile')
    .auth(token, { type: 'bearer' })
    .expect(401);
  const wrongClub = jwt.sign({
    sub: parent.user_id,
    email: parent.email,
    club_id: clubB.id,
    role: UserRole.SUPER_ADMIN,
    session_version: 0,
  });
  await request(app.getHttpServer())
    .get('/auth/profile')
    .auth(wrongClub, { type: 'bearer' })
    .expect(401);
});

it('preserves self-service password editing and invalidates the previous session', async () => {
  await request(app.getHttpServer())
    .patch(`/users/${parent.user_id}`)
    .auth(parentToken, { type: 'bearer' })
    .send({ first_name: 'Updated', password: 'ReplacementPassword123' })
    .expect(200);
  await request(app.getHttpServer())
    .get('/auth/profile')
    .auth(parentToken, { type: 'bearer' })
    .expect(401);
  const fresh = await login(parent, 'ReplacementPassword123');
  const profile = await request(app.getHttpServer())
    .get('/auth/profile')
    .auth(fresh, { type: 'bearer' })
    .expect(200);
  expect(profile.body.first_name).toBe('Updated');
  expect(profile.body.role).toBe(UserRole.PARENT);
});
