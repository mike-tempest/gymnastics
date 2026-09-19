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

  @IsUUID()
  request_key: string;

  @IsOptional()
  @IsString()
  fee_preview_hash?: string;

  /** Fees require an explicit choice and a current preview. */
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
