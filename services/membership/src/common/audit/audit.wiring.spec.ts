import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { AuditInterceptor } from './audit.interceptor';
import { TenantModule } from '../tenancy/tenant.module';
import { AuditLogsModule } from '../../modules/compliance/audit-logs/audit-logs.module';
import { AuditLog } from '../../modules/compliance/audit-logs/entities/audit-log.entity';
import { AuditLogsService } from '../../modules/compliance/audit-logs/audit-logs.service';

/**
 * The AuditInterceptor is registered as a global APP_INTERCEPTOR in
 * app.module.ts, which means its whole dependency chain has to resolve at boot:
 * AuditInterceptor -> AuditLogsService -> AuditLogsRepository -> the AuditLog
 * repository plus the globally provided tenancy helpers.
 *
 * If any link is missing, Nest fails at application start rather than at build
 * or typecheck time, so this compiles the real modules (with only the database
 * repository faked) to catch that class of wiring mistake in CI.
 */
describe('AuditInterceptor wiring', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        // Mirrors app.module.ts: the tenancy services depend on ClsService,
        // which is provided globally at the application root.
        ClsModule.forRoot({ global: true }),
        TenantModule,
        AuditLogsModule,
      ],
      providers: [AuditInterceptor],
    })
      .overrideProvider(getRepositoryToken(AuditLog))
      .useValue({ create: jest.fn(), save: jest.fn(), count: jest.fn(), delete: jest.fn() })
      .compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves the interceptor and its full dependency chain', () => {
    expect(moduleRef.get(AuditInterceptor)).toBeInstanceOf(AuditInterceptor);
  });

  it('exposes AuditLogsService from AuditLogsModule so the root interceptor can inject it', () => {
    // `exports: [AuditLogsService]` is what lets app.module.ts construct the
    // global interceptor; removing it would break boot, not compilation.
    expect(moduleRef.get(AuditLogsService, { strict: false })).toBeInstanceOf(AuditLogsService);
  });
});
