import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { FileImportService } from './file-import.service';
import { FileExportService } from './file-export.service';
import { CompetitionsRepository } from './competitions.repository';
import { PersonalBestsService } from './personal-bests.service';
import { TimesImportService } from './times-import.service';
import { Competition } from './entities/competition.entity';
import { CompetitionEntry } from './entities/competition-entry.entity';
import { CompetitionResult } from './entities/competition-result.entity';
import { PersonalBest } from './entities/personal-best.entity';
import { SwimmersModule } from '../swimmers/swimmers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Competition, CompetitionEntry, CompetitionResult, PersonalBest]),
    SwimmersModule,
  ],
  controllers: [CompetitionsController],
  providers: [
    CompetitionsService,
    FileImportService,
    FileExportService,
    TimesImportService,
    CompetitionsRepository,
    PersonalBestsService,
  ],
  exports: [
    CompetitionsService,
    FileImportService,
    FileExportService,
    TimesImportService,
    PersonalBestsService,
  ],
})
export class CompetitionsModule {}
