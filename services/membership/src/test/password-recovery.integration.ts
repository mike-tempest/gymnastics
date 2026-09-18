import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PasswordRecoveryController } from '../modules/auth/password-recovery.controller';
import {
  PasswordRecoveryService,
  RECOVERY_MESSAGE,
} from '../modules/auth/password-recovery.service';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';
import { JwtStrategy } from '../modules/auth/strategies/jwt.strategy';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { Club } from '../modules/clubs/entities/club.entity';
import { UsersRepository } from '../modules/users/users.repository';
import { UsersService } from '../modules/users/users.service';
import { TenantContextService } from '../common/tenancy/tenant-context.service';
import { EmailService } from '../modules/email/email.service';
import { AuditLogsService } from '../modules/compliance/audit-logs/audit-logs.service';
import { AddPasswordRecovery1789657200000 } from '../database/migrations/1789657200000-AddPasswordRecovery';

// This suite targets only the dedicated disposable container documented in
// docs/testing/password-recovery.md. It never reads application .env files.
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
const email = { sendPasswordRecovery: jest.fn().mockResolvedValue(undefined) };
const config = new ConfigService({
  APP_URL: 'https://tumblebase.example',
  JWT_SECRET: 'isolated-recovery-test-secret',
});
let recovery: PasswordRecoveryService;
let app: INestApplication;
let clubA: Club;
let clubB: Club;
let parent: User;
let otherParent: User;
let staff: User;

async function createUser(
  club: Club,
  role: UserRole,
  familyId: string = randomUUID(),
): Promise<User> {
  return database.getRepository(User).save(
    database.getRepository(User).create({
      club_id: club.id,
      email: `${randomUUID()}@example.com`,
      first_name: 'Test',
      last_name: 'Account',
      role,
      family_id: familyId,
      password_hash: await bcrypt.hash('OriginalPassword123', 10),
      active: true,
    }),
  );
}
async function issue(user: User): Promise<string> {
  await recovery.requestReset(user.email);
  const call = [...email.sendPasswordRecovery.mock.calls]
    .reverse()
    .find((item: string[]) => item[0] === user.email);
  expect(call).toBeDefined();
  return new URL(call![1]).hash.slice(1);
}
async function secretRow(user: User) {
  return database
    .getRepository(User)
    .createQueryBuilder('user')
    .addSelect([
      'user.password_hash',
      'user.password_reset_hash',
      'user.password_reset_expires_at',
      'user.password_reset_requested_at',
    ])
    .where('user.user_id = :id', { id: user.user_id })
    .getOneOrFail();
}
async function waitForRevocation(user: User) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await secretRow(user)).password_reset_hash === null) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Failed delivery link was not revoked');
}

beforeAll(async () => {
  await database.initialize();
  await database.runMigrations();
  const runner = database.createQueryRunner();
  expect(await runner.hasColumn('users', 'password_reset_hash')).toBe(true);
  const recoveryMigration = new AddPasswordRecovery1789657200000();
  await recoveryMigration.down(runner);
  expect(await runner.hasColumn('users', 'password_reset_hash')).toBe(false);
  await recoveryMigration.up(runner);
  expect(await runner.hasColumn('users', 'password_reset_hash')).toBe(true);
  await runner.release();
  clubA = await database
    .getRepository(Club)
    .save({ name: 'Recovery A', slug: `recovery-a-${randomUUID()}` });
  clubB = await database
    .getRepository(Club)
    .save({ name: 'Recovery B', slug: `recovery-b-${randomUUID()}` });
  recovery = new PasswordRecoveryService(database, email as unknown as EmailService, config);
  const users = new UsersService(
    new UsersRepository(database.getRepository(User), {} as TenantContextService),
  );
  const auth = new AuthService(
    users,
    new JwtService({ secret: config.get('JWT_SECRET'), signOptions: { expiresIn: '1h' } }),
    email as unknown as EmailService,
    config,
    { logLogin: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogsService,
    database,
  );
  const module = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
    controllers: [PasswordRecoveryController, AuthController],
    providers: [
      { provide: PasswordRecoveryService, useValue: recovery },
      { provide: AuthService, useValue: auth },
      { provide: JwtStrategy, useValue: new JwtStrategy(config, users) },
    ],
  }).compile();
  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
});
afterAll(async () => {
  await app?.close();
  if (database.isInitialized) await database.destroy();
});
beforeEach(async () => {
  email.sendPasswordRecovery.mockReset().mockResolvedValue(undefined);
  parent = await createUser(clubA, UserRole.PARENT);
  otherParent = await createUser(clubA, UserRole.PARENT, parent.family_id);
  staff = await createUser(clubB, UserRole.HEAD_COACH);
});

it('stores only a hash, gives a 30-minute expiry and hides recovery fields in normal reads', async () => {
  const token = await issue(parent);
  const row = await secretRow(parent);
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(row.password_reset_hash).not.toBe(token);
  expect(row.password_reset_expires_at!.getTime() - Date.now()).toBeGreaterThan(29 * 60 * 1000);
  expect(row.password_reset_expires_at!.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60 * 1000);
  const normal = await database.getRepository(User).findOneByOrFail({ user_id: parent.user_id });
  expect(normal.password_reset_hash).toBeUndefined();
  expect(normal.password_reset_expires_at).toBeUndefined();
  expect(normal.password_reset_requested_at).toBeUndefined();
});

it('returns the same response for unknown, inactive and active accounts', async () => {
  await database.getRepository(User).update(staff.user_id, { active: false });
  for (const address of ['unknown@example.com', staff.email, parent.email]) {
    expect(await recovery.requestReset(address)).toEqual({ message: RECOVERY_MESSAGE });
  }
  expect(email.sendPasswordRecovery).toHaveBeenCalledTimes(1);
});

it('normalises the address and refuses ambiguous case variants', async () => {
  await recovery.requestReset(`  ${parent.email.toUpperCase()}  `);
  expect(email.sendPasswordRecovery).toHaveBeenCalledWith(parent.email, expect.any(String));
  email.sendPasswordRecovery.mockClear();
  await database
    .getRepository(User)
    .update(staff.user_id, { email: otherParent.email.toUpperCase() });
  expect(await recovery.requestReset(otherParent.email)).toEqual({ message: RECOVERY_MESSAGE });
  expect(email.sendPasswordRecovery).not.toHaveBeenCalled();
});

it('serialises concurrent requests and enforces the shared per-account cooldown', async () => {
  await Promise.all(Array.from({ length: 5 }, () => recovery.requestReset(parent.email)));
  expect(email.sendPasswordRecovery).toHaveBeenCalledTimes(1);
  await recovery.requestReset(parent.email);
  expect(email.sendPasswordRecovery).toHaveBeenCalledTimes(1);
});

it('revokes a failed delivery without exposing it in the response', async () => {
  email.sendPasswordRecovery.mockRejectedValue(new Error('Simulated delivery failure'));
  expect(await recovery.requestReset(parent.email)).toEqual({ message: RECOVERY_MESSAGE });
  await waitForRevocation(parent);
  expect((await secretRow(parent)).session_version).toBe(0);
});

it('does not revoke a newer link when an older delivery fails later', async () => {
  let rejectOld!: (reason: Error) => void;
  email.sendPasswordRecovery.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectOld = reject;
      }),
  );
  await issue(parent);
  await database
    .getRepository(User)
    .update(parent.user_id, { password_reset_requested_at: new Date(Date.now() - 61000) });
  const newer = await issue(parent);
  rejectOld(new Error('Late provider failure'));
  await recovery.resetPassword(newer, 'Replacement123');
  expect((await secretRow(parent)).session_version).toBe(1);
});

it('changes only the requested account, preserving another parent in the same family and another club', async () => {
  const token = await issue(parent);
  await recovery.resetPassword(token, 'Replacement123');
  const changed = await secretRow(parent);
  expect(await bcrypt.compare('Replacement123', changed.password_hash!)).toBe(true);
  expect(await bcrypt.compare('OriginalPassword123', changed.password_hash!)).toBe(false);
  expect(changed.family_id).toBe(parent.family_id);
  expect(changed.club_id).toBe(clubA.id);
  expect(changed.role).toBe(UserRole.PARENT);
  for (const unchanged of [otherParent, staff]) {
    const row = await secretRow(unchanged);
    expect(await bcrypt.compare('OriginalPassword123', row.password_hash!)).toBe(true);
    expect(row.session_version).toBe(0);
  }
  await expect(recovery.resetPassword(token, 'SecondReplacement123')).rejects.toThrow(
    'invalid or has expired',
  );
});

it('supports staff recovery and allows exactly one concurrent consumer', async () => {
  const token = await issue(staff);
  const results = await Promise.allSettled([
    recovery.resetPassword(token, 'ReplacementOne123'),
    recovery.resetPassword(token, 'ReplacementTwo123'),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  expect((await secretRow(staff)).session_version).toBe(1);
});

it('rejects expired and unknown tokens without changing credentials', async () => {
  const token = await issue(parent);
  await database
    .getRepository(User)
    .update(parent.user_id, { password_reset_expires_at: new Date(Date.now() - 1) });
  await expect(recovery.resetPassword(token, 'Replacement123')).rejects.toThrow(
    'invalid or has expired',
  );
  await expect(recovery.resetPassword('0'.repeat(64), 'Replacement123')).rejects.toThrow(
    'invalid or has expired',
  );
  expect((await secretRow(parent)).session_version).toBe(0);
});

it('rejects a token when its account has been deactivated', async () => {
  const token = await issue(staff);
  await database.getRepository(User).update(staff.user_id, { active: false });
  await expect(recovery.resetPassword(token, 'Replacement123')).rejects.toThrow();
});

it('invalidates existing links when staff change the email or password', async () => {
  const repository = new UsersRepository(database.getRepository(User), {} as TenantContextService);
  const oldToken = await issue(parent);
  await repository.update(parent.user_id, { email: `${randomUUID()}@example.com` });
  await expect(recovery.resetPassword(oldToken, 'Replacement123')).rejects.toThrow();
  const staffToken = await issue(staff);
  await repository.update(staff.user_id, {}, await bcrypt.hash('StaffChanged123', 10));
  await expect(recovery.resetPassword(staffToken, 'Replacement123')).rejects.toThrow();
  expect((await secretRow(staff)).session_version).toBe(1);
});

it('runs the HTTP journey: old JWT revoked, old password rejected, new login accepted', async () => {
  const server = app.getHttpServer();
  const old = await request(server)
    .post('/auth/login')
    .send({ email: parent.email, password: 'OriginalPassword123' })
    .expect(201);
  await request(server)
    .get('/auth/profile')
    .auth(old.body.access_token, { type: 'bearer' })
    .expect(200);
  const token = await issue(parent);
  await request(server)
    .post('/auth/reset-password')
    .send({ token, password: 'Replacement123' })
    .expect(200);
  await request(server)
    .get('/auth/profile')
    .auth(old.body.access_token, { type: 'bearer' })
    .expect(401);
  await request(server)
    .post('/auth/login')
    .send({ email: parent.email, password: 'OriginalPassword123' })
    .expect(401);
  const fresh = await request(server)
    .post('/auth/login')
    .send({ email: parent.email, password: 'Replacement123' })
    .expect(201);
  await request(server)
    .get('/auth/profile')
    .auth(fresh.body.access_token, { type: 'bearer' })
    .expect(200);
  expect(fresh.body.user).not.toHaveProperty('password_reset_hash');
});

it('rejects account substitution through HTTP and enforces IP request limits', async () => {
  const server = app.getHttpServer();
  await request(server)
    .post('/auth/forgot-password')
    .send({ email: parent.email, club_id: clubB.id })
    .expect(400);
  const token = await issue(parent);
  await request(server)
    .post('/auth/reset-password')
    .send({ token, password: 'Replacement123', user_id: staff.user_id })
    .expect(400);
  for (let i = 0; i < 4; i++) {
    const result = await request(server)
      .post('/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(200);
    expect(result.body).toEqual({ message: RECOVERY_MESSAGE });
  }
  await request(server).post('/auth/forgot-password').send({ email: parent.email }).expect(429);
});
