import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WellbeingController } from './wellbeing.controller';
import { WellbeingService } from './wellbeing.service';
import { WellbeingRepository } from './wellbeing.repository';
import { WellbeingLog } from './entities/wellbeing-log.entity';
import { CycleLog } from './entities/cycle-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WellbeingLog, CycleLog])],
  controllers: [WellbeingController],
  providers: [WellbeingService, WellbeingRepository],
  exports: [WellbeingService, WellbeingRepository],
})
export class WellbeingModule {}
