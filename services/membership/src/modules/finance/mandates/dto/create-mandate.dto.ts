import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { DirectDebitMandateStatus } from '../entities/direct-debit-mandate.entity';

export class CreateMandateDto {
  @IsNotEmpty()
  @IsUUID()
  family_id: string;

  @IsNotEmpty()
  @IsString()
  provider_mandate_id: string;

  /**
   * Payment provider the mandate is held with ('gocardless' | 'stripe').
   * Optional: omitted for manually recorded mandates, where the entity default
   * ('gocardless') preserves existing behaviour. Set internally from the bound
   * provider on the redirect-flow completion path.
   */
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  provider_customer_id?: string;

  @IsOptional()
  @IsString()
  account_holder_name?: string;

  @IsOptional()
  @IsString()
  last_four_digits?: string;

  @IsOptional()
  @IsEnum(DirectDebitMandateStatus)
  status?: DirectDebitMandateStatus;

  @IsOptional()
  @IsString()
  scheme?: string;
}
