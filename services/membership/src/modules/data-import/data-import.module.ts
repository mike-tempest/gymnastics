import { Module } from '@nestjs/common';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';
import { FamiliesModule } from '../families/families.module';
import { MembersModule } from '../members/members.module';
import { SquadsModule } from '../squads/squads.module';

@Module({
  imports: [FamiliesModule, MembersModule, SquadsModule],
  controllers: [DataImportController],
  providers: [DataImportService],
})
export class DataImportModule {}
