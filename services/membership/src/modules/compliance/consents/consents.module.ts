import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consent } from './entities/consent.entity';
import { ConsentsService } from './consents.service';
import { ConsentsController } from './consents.controller';
import { ConsentsRepository } from './consents.repository';
import { MembersModule } from '../../members/members.module';
import { UsersModule } from '../../users/users.module';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Consent]), MembersModule, UsersModule, EmailModule],
  controllers: [ConsentsController],
  providers: [ConsentsService, ConsentsRepository],
  exports: [ConsentsService],
})
export class ConsentsModule {}
