import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeStructuresController } from './fee-structures.controller';
import { FeeStructuresService } from './fee-structures.service';
import { FeeStructuresRepository } from './fee-structures.repository';
import { FeeStructure } from './entities/fee-structure.entity';
import { SquadsModule } from '../../squads/squads.module';

@Module({
  imports: [TypeOrmModule.forFeature([FeeStructure]), SquadsModule],
  controllers: [FeeStructuresController],
  providers: [FeeStructuresService, FeeStructuresRepository],
  exports: [FeeStructuresService, FeeStructuresRepository],
})
export class FeeStructuresModule {}
