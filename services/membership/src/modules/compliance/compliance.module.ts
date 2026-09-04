import { Module } from '@nestjs/common';
import { DBSModule } from './dbs/dbs.module';
import { ConsentsModule } from './consents/consents.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { SafeguardingModule } from './safeguarding/safeguarding.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

@Module({
  imports: [DBSModule, ConsentsModule, AuditLogsModule, SafeguardingModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [DBSModule, ConsentsModule, AuditLogsModule, SafeguardingModule, ComplianceService],
})
export class ComplianceModule {}
