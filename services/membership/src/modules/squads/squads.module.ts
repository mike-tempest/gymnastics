import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SquadsController } from './squads.controller';
import { SquadsService } from './squads.service';
import { SquadsRepository } from './squads.repository';
import { Squad } from './entities/squad.entity';
import { Member } from '../members/entities/member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Squad, Member])],
  controllers: [SquadsController],
  providers: [SquadsService, SquadsRepository],
  exports: [SquadsService, SquadsRepository],
})
export class SquadsModule {}
