import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsDateString,
  Length,
  Min,
} from 'class-validator';
import { PaymentMethod, PaymentStatus } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  invoice_id: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  /**
   * ISO 4217 currency for the payment. Optional: when omitted the entity default
   * (GBP) applies. Set internally from the invoice's currency on the automatic
   * Direct Debit collection path.
   */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  /**
   * Payment provider that processed the payment ('gocardless' | 'stripe').
   * Optional: manually recorded payments have no provider and the entity
   * default preserves existing behaviour. Set internally from the bound
   * provider on the automatic collection path.
   */
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  provider_payment_id?: string;

  @IsOptional()
  @IsString()
  reference_number?: string;

  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
