import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FamiliesController } from '../families/families.controller';
import { FamiliesService } from '../families/families.service';

const SELF = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('Account management HTTP permissions', () => {
  let app: INestApplication;
  let role: UserRole;
  const service = {
    create: jest.fn(),
    bulkCreateStaff: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const families = { acceptInvite: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController, FamiliesController],
      providers: [
        RolesGuard,
        { provide: UsersService, useValue: service },
        { provide: FamiliesService, useValue: families },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().user = { user_id: SELF, role, club_id: 'club-a' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('requires authenticated invitation acceptance and cannot link another account', async () => {
    role = UserRole.PARENT;
    expect(Reflect.getMetadata('isPublic', FamiliesController.prototype.acceptInvite)).not.toBe(
      true,
    );
    await request(app.getHttpServer())
      .post('/families/invite/accept')
      .send({ token: 'synthetic', userId: OTHER })
      .expect(403);
    expect(families.acceptInvite).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/families/invite/accept')
      .send({ token: 'synthetic' })
      .expect(200);
    expect(families.acceptInvite).toHaveBeenCalledWith('synthetic', SELF);
  });

  it.each(Object.values(UserRole))('limits account administration for %s', async (currentRole) => {
    role = currentRole;
    const admin = role === UserRole.SUPER_ADMIN;
    const account = {
      email: 'synthetic@example.test',
      password: 'SyntheticOnly123',
      first_name: 'Test',
      last_name: 'Only',
      role: UserRole.SUPER_ADMIN,
    };
    await request(app.getHttpServer())
      .post('/users')
      .send(account)
      .expect(admin ? 201 : 403);
    await request(app.getHttpServer())
      .post('/users/bulk')
      .send({ users: [{ ...account, role: UserRole.WELFARE_OFFICER, password: undefined }] })
      .expect(admin ? 201 : 403);
    await request(app.getHttpServer())
      .delete(`/users/${OTHER}`)
      .expect(admin ? 200 : 403);
    await request(app.getHttpServer())
      .patch(`/users/${OTHER}`)
      .send({ password: 'ChangedPassword123' })
      .expect(admin ? 200 : 403);
    for (const field of [
      { role: UserRole.SUPER_ADMIN },
      { role: UserRole.WELFARE_OFFICER },
      { active: true },
      { family_id: OTHER },
      { family_id: null },
    ]) {
      await request(app.getHttpServer())
        .patch(`/users/${SELF}`)
        .send(field)
        .expect(admin ? 200 : 403);
    }
    expect(service.create).toHaveBeenCalledTimes(admin ? 1 : 0);
    expect(service.bulkCreateStaff).toHaveBeenCalledTimes(admin ? 1 : 0);
    expect(service.remove).toHaveBeenCalledTimes(admin ? 1 : 0);
    expect(service.update).toHaveBeenCalledTimes(admin ? 6 : 0);
  });

  it.each(Object.values(UserRole))(
    'preserves safe own-profile updates for %s',
    async (currentRole) => {
      role = currentRole;
      const update = {
        first_name: 'Updated',
        email: 'updated@example.test',
        password: 'Replacement123',
      };
      await request(app.getHttpServer()).patch(`/users/${SELF}`).send(update).expect(200);
      expect(service.update).toHaveBeenCalledWith(SELF, update);
    },
  );

  it('rejects tenant and reset-state injection even for an administrator', async () => {
    role = UserRole.SUPER_ADMIN;
    for (const field of [
      { club_id: OTHER },
      { password_reset_hash: 'injected' },
      { session_version: 0 },
    ]) {
      await request(app.getHttpServer()).patch(`/users/${SELF}`).send(field).expect(400);
    }
    expect(service.update).not.toHaveBeenCalled();
  });
});
