import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentsModule } from '../compliance/consents/consents.module';
import { EmailModule } from '../email/email.module';
import { FamiliesModule } from '../families/families.module';
import { MandatesModule } from '../finance/mandates/mandates.module';
import { MembersModule } from '../members/members.module';
import { SquadsModule } from '../squads/squads.module';
import { UsersModule } from '../users/users.module';
import { EnrolmentService } from './enrolment.service';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { WaitingListOffer } from './entities/waiting-list-offer.entity';
import { WaitingListSettings } from './entities/waiting-list-settings.entity';
import { WaitingListController } from './waiting-list.controller';
import { WaitingListOffersService } from './waiting-list-offers.service';
import { WaitingListRepository } from './waiting-list.repository';
import { WaitingListService } from './waiting-list.service';

/**
 * The club's waiting list and the one-click enrolment behind it (TEM-22).
 *
 * Distinct from WaitlistModule, which is the product's own launch waiting
 * list. Nothing here touches it.
 *
 * The module depends on squads, members, families, consents and mandates
 * because enrolment writes to all of them; none of them depends on this
 * module in return. The one signal that has to travel the other way, "a place
 * may have opened in this squad", goes through the global SquadCapacityEvents
 * bus rather than an import, which is what keeps the dependency one-way.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WaitingListEntry, WaitingListOffer, WaitingListSettings]),
    SquadsModule,
    MembersModule,
    FamiliesModule,
    UsersModule,
    ConsentsModule,
    MandatesModule,
    EmailModule,
  ],
  controllers: [WaitingListController],
  providers: [
    WaitingListService,
    WaitingListOffersService,
    WaitingListRepository,
    EnrolmentService,
  ],
  exports: [WaitingListService, WaitingListOffersService, WaitingListRepository],
})
export class WaitingListModule {}
