import { Module } from '@nestjs/common';
import { BillingBalanceService } from './billing-balance.service';
@Module({ providers: [BillingBalanceService], exports: [BillingBalanceService] })
export class BillingLedgerModule {}
