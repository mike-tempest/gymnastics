import { EmailModule } from '../../email/email.module';
import { Module } from '@nestjs/common';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { BillingLedgerModule } from './billing-ledger.module';
import { PaymentOperationsService } from './payment-operations.service';
@Module({
  imports: [EmailModule, PaymentProvidersModule, BillingLedgerModule],
  providers: [PaymentOperationsService],
  exports: [PaymentOperationsService],
})
export class PaymentOperationsModule {}
