import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwardsController } from './awards.controller';
import { AwardsService } from './awards.service';
import { AwardsRepository } from './awards.repository';
import { AwardScheme } from './entities/award-scheme.entity';
import { AwardLevel } from './entities/award-level.entity';
import { MemberAwardProgress } from './entities/member-award-progress.entity';
import { AssessmentEvent, AssessmentOutcome } from './entities/assessment-event.entity';
import { InvoicesModule } from '../finance/invoices/invoices.module';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AwardScheme,
      AwardLevel,
      MemberAwardProgress,
      AssessmentEvent,
      AssessmentOutcome,
    ]),
    // Badge fees bill through the normal finance path: InvoicesService.create
    // resolves currency and tax, emails the family and attempts Direct Debit.
    InvoicesModule,
    MembersModule,
  ],
  controllers: [AwardsController],
  providers: [AwardsService, AwardsRepository],
  exports: [AwardsService, AwardsRepository],
})
export class AwardsModule {}
