import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/entities/user.entity';
import { ExportController } from '../../export/export.controller';
import { ExportService } from '../../export/export.service';
import { SafeguardingController } from './safeguarding.controller';
import { SafeguardingService } from './safeguarding.service';

describe('Sensitive incident routes with the real RolesGuard', () => {
  let app: INestApplication;
  let currentRole: UserRole;
  const safeguarding = {
    getIncidents: jest.fn().mockResolvedValue([{ id: 'synthetic', summary: 'Restricted test' }]),
    createIncident: jest.fn().mockResolvedValue({ id: 'synthetic' }),
  };
  const exports = {
    buildClubExport: jest
      .fn()
      .mockResolvedValue({ buffer: Buffer.from('test'), filename: 'test.zip' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SafeguardingController, ExportController],
      providers: [
        RolesGuard,
        { provide: SafeguardingService, useValue: safeguarding },
        { provide: ExportService, useValue: exports },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().user = { role: currentRole, club_id: 'club-a' };
          return true;
        },
      })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it.each(Object.values(UserRole))(
    'enforces explicit incident read/report access for %s',
    async (role) => {
      currentRole = role;
      const allowed = role === UserRole.SUPER_ADMIN || role === UserRole.WELFARE_OFFICER;
      await request(app.getHttpServer())
        .get('/compliance/safeguarding/incidents')
        .expect(allowed ? 200 : 403);
      await request(app.getHttpServer())
        .post('/compliance/safeguarding/incidents')
        .send({
          date: '2026-09-18',
          category: 'Test only',
          summary: 'Synthetic',
          reported_by: 'Test',
        })
        .expect(allowed ? 201 : 403);
      expect(safeguarding.getIncidents).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(safeguarding.createIncident).toHaveBeenCalledTimes(allowed ? 1 : 0);
    },
  );

  it.each(Object.values(UserRole))(
    'enforces administrator-only full export for %s',
    async (role) => {
      currentRole = role;
      await request(app.getHttpServer())
        .get('/export/club.zip')
        .expect(role === UserRole.SUPER_ADMIN ? 200 : 403);
      expect(exports.buildClubExport).toHaveBeenCalledTimes(role === UserRole.SUPER_ADMIN ? 1 : 0);
    },
  );

  it('rejects the next request after the current user loses their welfare role', async () => {
    currentRole = UserRole.WELFARE_OFFICER;
    await request(app.getHttpServer()).get('/compliance/safeguarding/incidents').expect(200);
    currentRole = UserRole.SQUAD_COACH;
    await request(app.getHttpServer()).get('/compliance/safeguarding/incidents').expect(403);
    expect(safeguarding.getIncidents).toHaveBeenCalledTimes(1);
  });
});
