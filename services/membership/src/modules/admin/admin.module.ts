import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ClubSettings } from './settings/club-settings.entity';
import { ClubSettingsService } from './settings/club-settings.service';
import { Member } from '../members/entities/member.entity';
import { Family } from '../families/entities/family.entity';
import { Squad } from '../squads/entities/squad.entity';
import { Session } from '../sessions/entities/session.entity';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { Payment } from '../finance/payments/entities/payment.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Club } from '../clubs/entities/club.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Member,
      Family,
      Squad,
      Session,
      Invoice,
      Payment,
      Attendance,
      ClubSettings,
      Club,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, ClubSettingsService],
  exports: [AdminService, ClubSettingsService],
})
export class AdminModule {}
