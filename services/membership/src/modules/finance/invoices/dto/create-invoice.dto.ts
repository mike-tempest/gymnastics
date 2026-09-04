import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '../entities/invoice.entity';

export class CreateInvoiceItemDto {
  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsUUID()
  fee_structure_id?: string;
}

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsUUID()
  family_id: string;

  @IsNotEmpty()
  @IsDateString()
  due_date: string;

  @IsNotEmpty()
  @IsDateString()
  issued_date: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Set by the invoice-generation engine so re-runs can detect that this
   * family was already invoiced for the fee structure and billing period.
   * Omitted for manually created invoices.
   */
  @IsOptional()
  @IsUUID()
  fee_structure_id?: string;

  /** The billing period the generated invoice covers, e.g. '2026-07'. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  billing_period?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];
}
