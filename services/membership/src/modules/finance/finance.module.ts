import { BillingLedgerModule } from './adjustments/billing-ledger.module';
import { BillingAdjustmentsModule } from './adjustments/billing-adjustments.module';
import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FeeStructuresModule } from './fee-structures/fee-structures.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { MandatesModule } from './mandates/mandates.module';

@Module({
  imports: [
    BillingLedgerModule,
    BillingAdjustmentsModule,
    FeeStructuresModule,
    InvoicesModule,
    PaymentsModule,
    MandatesModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService, FeeStructuresModule, InvoicesModule, PaymentsModule, MandatesModule],
})
export class FinanceModule {}
