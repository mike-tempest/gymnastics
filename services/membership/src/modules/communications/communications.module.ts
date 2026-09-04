import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CommunicationsRepository } from './communications.repository';
import { Communication } from './entities/communication.entity';
import { Family } from '../families/entities/family.entity';
import { Swimmer } from '../swimmers/entities/swimmer.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Communication, Family, Swimmer]), EmailModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService, CommunicationsRepository],
  exports: [CommunicationsService, CommunicationsRepository],
})
export class CommunicationsModule {}
