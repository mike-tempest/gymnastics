import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { ClubsRepository } from './clubs.repository';
import { Club } from './entities/club.entity';
import { PaymentConnectionsModule } from '../finance/payment-connections/payment-connections.module';

// Global: the club (tenant root) is needed by request-path code and by
// background jobs (e.g. per-club cron sweeps), so expose it everywhere.
// PaymentConnectionsModule depends only on the database and config, so the
// import (for the payment_provider field on /clubs/me) introduces no cycle.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Club]), PaymentConnectionsModule],
  controllers: [ClubsController],
  providers: [ClubsService, ClubsRepository],
  exports: [ClubsService, ClubsRepository],
})
export class ClubsModule {}
