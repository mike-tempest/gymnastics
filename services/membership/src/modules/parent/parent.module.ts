import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';
import { Swimmer } from '../swimmers/entities/swimmer.entity';
import { Session } from '../sessions/entities/session.entity';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Family } from '../families/entities/family.entity';
import { Payment } from '../finance/payments/entities/payment.entity';
import { DirectDebitMandate } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { GoCardlessModule } from '../gocardless/gocardless.module';
import { InvoicePdfService } from '../finance/invoices/invoice-pdf.service';
import { CompetitionsModule } from '../competitions/competitions.module';
import { CompetitionResult } from '../competitions/entities/competition-result.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Swimmer,
      Session,
      Invoice,
      Attendance,
      Family,
      Payment,
      DirectDebitMandate,
      CompetitionResult,
    ]),
    GoCardlessModule,
    CompetitionsModule,
  ],
  controllers: [ParentController],
  // InvoicePdfService is a stateless renderer whose only dependency
  // (ClubsRepository) comes from the global ClubsModule, so it is provided
  // directly rather than importing the whole InvoicesModule dependency chain.
  providers: [ParentService, InvoicePdfService],
  exports: [ParentService],
})
export class ParentModule {}
