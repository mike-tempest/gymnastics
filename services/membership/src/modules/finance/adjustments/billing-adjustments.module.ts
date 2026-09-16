import { Module } from '@nestjs/common';
import { BillingLedgerModule } from './billing-ledger.module';
import { PaymentOperationsModule } from './payment-operations.module';
import { BillingAdjustmentsService } from './billing-adjustments.service';
import { BillingAdjustmentsController } from './billing-adjustments.controller';
@Module({
  imports: [BillingLedgerModule, PaymentOperationsModule],
  providers: [BillingAdjustmentsService],
  controllers: [BillingAdjustmentsController],
})
export class BillingAdjustmentsModule {}
