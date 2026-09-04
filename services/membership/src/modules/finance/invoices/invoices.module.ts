import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { InvoicePdfService } from './invoice-pdf.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { FeeStructuresModule } from '../fee-structures/fee-structures.module';
import { PaymentsModule } from '../payments/payments.module';
import { EmailModule } from '../../email/email.module';
import { FamiliesModule } from '../../families/families.module';
import { SwimmersModule } from '../../swimmers/swimmers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem]),
    FeeStructuresModule,
    forwardRef(() => PaymentsModule),
    EmailModule,
    FamiliesModule,
    SwimmersModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository, InvoicePdfService],
  exports: [InvoicesService, InvoicesRepository, InvoicePdfService],
})
export class InvoicesModule {}
