import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import {
  GoCardlessCustomerRowDto,
  GoCardlessMandateRowDto,
  GoCardlessPaymentRowDto,
} from './gocardless-import-row.dto';

export class GoCardlessImportOptionsDto {
  /**
   * Create a family for a GoCardless customer whose email matches no existing
   * family. Off means the takeover only attaches mandates to families the club
   * has already imported, and unmatched customers are reported as skipped.
   */
  @IsBoolean()
  create_missing_families: boolean;
}

/** Wraps the three GoCardless dashboard exports plus import options. */
export class ImportGoCardlessDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoCardlessCustomerRowDto)
  customers: GoCardlessCustomerRowDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoCardlessMandateRowDto)
  mandates: GoCardlessMandateRowDto[];

  /** Optional: payments are summarised for reconciliation but never written. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoCardlessPaymentRowDto)
  payments?: GoCardlessPaymentRowDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => GoCardlessImportOptionsDto)
  options: GoCardlessImportOptionsDto;
}
