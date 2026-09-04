import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { Session } from './entities/session.entity';
import { EmailModule } from '../email/email.module';
import { SwimmersModule } from '../swimmers/swimmers.module';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [TypeOrmModule.forFeature([Session]), EmailModule, SwimmersModule, FamiliesModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsRepository],
  exports: [SessionsService, SessionsRepository],
})
export class SessionsModule {}
