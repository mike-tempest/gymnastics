import { NotificationDeliveriesModule } from '../notification-deliveries/notification-deliveries.module';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { Session } from './entities/session.entity';
import { EmailModule } from '../email/email.module';
import { MembersModule } from '../members/members.module';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [
    NotificationDeliveriesModule,
    TypeOrmModule.forFeature([Session]),
    EmailModule,
    MembersModule,
    FamiliesModule,
  ],
  controllers: [SessionsController, TimetableController],
  providers: [SessionsService, SessionsRepository, TimetableService],
  exports: [SessionsService, SessionsRepository],
})
export class SessionsModule {}
