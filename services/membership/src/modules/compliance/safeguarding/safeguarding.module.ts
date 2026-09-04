import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafeguardingController } from './safeguarding.controller';
import { SafeguardingService } from './safeguarding.service';
import { ChecklistItem } from './entities/checklist-item.entity';
import { SafeguardingOfficer } from './entities/safeguarding-officer.entity';
import { Incident } from './entities/incident.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChecklistItem, SafeguardingOfficer, Incident])],
  controllers: [SafeguardingController],
  providers: [SafeguardingService],
  exports: [SafeguardingService],
})
export class SafeguardingModule {}
