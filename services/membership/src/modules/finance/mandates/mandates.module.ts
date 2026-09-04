import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MandatesController } from './mandates.controller';
import { MandatesService } from './mandates.service';
import { MandatesRepository } from './mandates.repository';
import { DirectDebitMandate } from './entities/direct-debit-mandate.entity';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';

@Module({
  imports: [TypeOrmModule.forFeature([DirectDebitMandate]), PaymentProvidersModule],
  controllers: [MandatesController],
  providers: [MandatesService, MandatesRepository],
  exports: [MandatesService, MandatesRepository],
})
export class MandatesModule {}
