import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { Attendance } from './entities/attendance.entity';
import { MembersModule } from '../members/members.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  // A register is the session's squad crossed with its attendance rows, so the
  // service reads sessions and members through their own tenant-scoped
  // repositories rather than reaching for those tables directly.
  imports: [TypeOrmModule.forFeature([Attendance]), MembersModule, SessionsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRepository],
  exports: [AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}
