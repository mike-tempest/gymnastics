import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../compliance/audit-logs/audit-logs.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

/**
 * The full club data export (TEM-31).
 *
 * No TypeOrmModule.forFeature() here on purpose: the export reads every
 * tenant-owned table listed in export.manifest.ts, and registering two dozen
 * repositories by hand would go stale the moment a table is added. The service
 * resolves repositories from the shared DataSource instead, and still routes
 * every read through the global TenantScopedHelper.
 */
@Module({
  // The global AuditInterceptor does not record GETs, so the export writes its
  // own audit entry: a bulk copy of every medical and safeguarding record is
  // the last thing that should leave no trace.
  imports: [AuditLogsModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
