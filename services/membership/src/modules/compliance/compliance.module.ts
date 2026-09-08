import { Module } from '@nestjs/common';
import { DBSModule } from './dbs/dbs.module';
import { ConsentsModule } from './consents/consents.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { SafeguardingModule } from './safeguarding/safeguarding.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { MembersModule } from '../members/members.module';

@Module({
  // MembersModule supplies the club's real member total, which the summary
  // needs to say how many members have no consent on file at all.
  imports: [DBSModule, ConsentsModule, AuditLogsModule, SafeguardingModule, MembersModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [DBSModule, ConsentsModule, AuditLogsModule, SafeguardingModule, ComplianceService],
})
export class ComplianceModule {}
