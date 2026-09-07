import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { typeOrmConfigAsync } from './config/typeorm.config';
import { TenantModule } from './common/tenancy/tenant.module';
import { TenantInterceptor } from './common/tenancy/tenant.interceptor';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { AuditLogsModule } from './modules/compliance/audit-logs/audit-logs.module';
import { validate } from './config/env.validation';
import { competitionsEnabled } from './common/features/competitions.feature';
import { MembersModule } from './modules/members/members.module';
import { SquadsModule } from './modules/squads/squads.module';
import { FamiliesModule } from './modules/families/families.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { FinanceModule } from './modules/finance/finance.module';
import { EmailModule } from './modules/email/email.module';
import { AdminModule } from './modules/admin/admin.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { TestingModule } from './modules/testing/testing.module';
import { ParentModule } from './modules/parent/parent.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { HealthModule } from './modules/health/health.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { WellbeingModule } from './modules/wellbeing/wellbeing.module';
import { AwardsModule } from './modules/awards/awards.module';
import { ClubsModule } from './modules/clubs/clubs.module';
import { DataImportModule } from './modules/data-import/data-import.module';
import { ActivationModule } from './modules/activation/activation.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    // Rate limiting: Protect against brute-force attacks
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time window: 60 seconds
        limit: 60, // Maximum 60 requests per window per IP
      },
    ]),
    // CLS (AsyncLocalStorage) request context holding the active tenant.
    // The mounted middleware establishes the store at the start of every
    // request, before guards and interceptors run.
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    // Scheduler registered exactly once at the app root. Calling forRoot()
    // in feature modules creates duplicate scheduler instances, which is why
    // every @Cron job was firing 5-6 times per scheduled run.
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync(typeOrmConfigAsync),
    TenantModule,
    // Imported at the root so the global AuditInterceptor below can inject
    // AuditLogsService. ComplianceModule also imports it; Nest resolves the
    // module once and shares the same provider instance.
    AuditLogsModule,
    ClubsModule,
    MembersModule,
    SquadsModule,
    FamiliesModule,
    UsersModule,
    AuthModule,
    SessionsModule,
    AttendanceModule,
    FinanceModule,
    EmailModule,
    AdminModule,
    ComplianceModule,
    TestingModule,
    ParentModule,
    CommunicationsModule,
    WaitlistModule,
    HealthModule,
    // Swimming times/strokes module, feature-flagged off by default (TEM-15).
    // With the flag unset its controllers are never mounted, so /competitions
    // routes 404. Env files are loaded by config/env.preload.ts (first import
    // in main.ts), so this spread and ParentModule's agree on the flag.
    ...(competitionsEnabled() ? [CompetitionsModule] : []),
    WellbeingModule,
    AwardsModule,
    DataImportModule,
    ActivationModule,
  ],
  controllers: [AppController],
  providers: [
    // Lifts req.user.club_id into CLS as `clubId` on authenticated requests.
    // Tolerates public routes (no req.user) without throwing.
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    // Records who did what to which entity. Reads club_id straight from
    // req.user rather than CLS, so it does not depend on running after the
    // TenantInterceptor. Writes are fire-and-forget and can never fail a
    // request. Read (GET) traffic is only recorded when AUDIT_LOG_VIEWS=true.
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
