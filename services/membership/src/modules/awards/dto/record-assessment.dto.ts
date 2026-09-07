import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  IsBoolean,
  IsDateString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssessmentOutcomeResult, AwardProgressStatus } from '@club-manager/shared-types';

export class AssessmentOutcomeDto {
  @IsNotEmpty()
  @IsUUID()
  member_id: string;

  @IsNotEmpty()
  @IsEnum(AssessmentOutcomeResult)
  outcome: AssessmentOutcomeResult;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class RecordAssessmentDto {
  @IsNotEmpty()
  @IsUUID()
  level_id: string;

  @IsNotEmpty()
  @IsDateString()
  assessed_at: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  /**
   * Raise badge and certificate invoices for the members awarded. Defaults to
   * true: a priced level bills through the normal finance path unless the
   * coach deliberately turns it off, for example when re-recording history.
   */
  @IsOptional()
  @IsBoolean()
  bill_fees?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssessmentOutcomeDto)
  outcomes: AssessmentOutcomeDto[];
}

/** Sets or clears where a single member is on a single level, without an assessment. */
export class SetProgressDto {
  @IsNotEmpty()
  @IsUUID()
  member_id: string;

  @IsNotEmpty()
  @IsUUID()
  level_id: string;

  @IsNotEmpty()
  @IsEnum(AwardProgressStatus)
  status: AwardProgressStatus;

  @IsOptional()
  @IsDateString()
  started_on?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
