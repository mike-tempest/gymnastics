import { Module } from '@nestjs/common';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';
import { GoCardlessTakeoverService } from './gocardless-takeover.service';
import { FamiliesModule } from '../families/families.module';
import { MembersModule } from '../members/members.module';
import { SquadsModule } from '../squads/squads.module';
// MandatesModule is imported for its repository only. The takeover writes
// mandate rows through MandatesRepository while respecting the same invariants
// MandatesService enforces; no GoCardless API call is involved.
import { MandatesModule } from '../finance/mandates/mandates.module';

@Module({
  imports: [FamiliesModule, MembersModule, SquadsModule, MandatesModule],
  controllers: [DataImportController],
  providers: [DataImportService, GoCardlessTakeoverService],
})
export class DataImportModule {}
