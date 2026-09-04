import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwimmersController } from './swimmers.controller';
import { SwimmersService } from './swimmers.service';
import { SwimmersRepository } from './swimmers.repository';
import { Swimmer } from './entities/swimmer.entity';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [TypeOrmModule.forFeature([Swimmer]), FamiliesModule],
  controllers: [SwimmersController],
  providers: [SwimmersService, SwimmersRepository],
  exports: [SwimmersService, SwimmersRepository],
})
export class SwimmersModule {}
