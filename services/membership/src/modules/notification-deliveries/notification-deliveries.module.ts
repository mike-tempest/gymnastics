import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { NotificationDeliveriesController } from './notification-deliveries.controller';
import { NotificationDeliveriesService } from './notification-deliveries.service';
import { OperationalMessagesService } from './operational-messages.service';
import { ResendEventsController } from './resend-events.controller';

@Module({
  imports: [EmailModule, ConfigModule],
  controllers: [NotificationDeliveriesController, ResendEventsController],
  providers: [NotificationDeliveriesService, OperationalMessagesService],
  exports: [NotificationDeliveriesService, OperationalMessagesService],
})
export class NotificationDeliveriesModule {}
