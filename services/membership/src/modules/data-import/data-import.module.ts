import { Module } from '@nestjs/common';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';
import { FamiliesModule } from '../families/families.module';
import { SwimmersModule } from '../swimmers/swimmers.module';
import { SquadsModule } from '../squads/squads.module';

@Module({
  imports: [FamiliesModule, SwimmersModule, SquadsModule],
  controllers: [DataImportController],
  providers: [DataImportService],
})
export class DataImportModule {}
