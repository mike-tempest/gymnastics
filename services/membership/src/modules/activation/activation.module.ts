import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Club } from '../clubs/entities/club.entity';
import { Session } from '../sessions/entities/session.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { User } from '../users/entities/user.entity';
import { EmailModule } from '../email/email.module';
import { ActivationService } from './activation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Club, Session, Attendance, User]), EmailModule],
  providers: [ActivationService],
})
export class ActivationModule {}
