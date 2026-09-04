import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { Payment } from './entities/payment.entity';
import { InvoicesModule } from '../invoices/invoices.module';
import { MandatesModule } from '../mandates/mandates.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { FamiliesModule } from '../../families/families.module';
import { EmailModule } from '../../email/email.module';
import { PaymentCollectionTask } from './payment-collection.task';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    forwardRef(() => InvoicesModule),
    MandatesModule,
    PaymentProvidersModule,
    FamiliesModule,
    EmailModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, PaymentCollectionTask],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
