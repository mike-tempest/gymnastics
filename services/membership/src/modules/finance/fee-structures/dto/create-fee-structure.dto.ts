import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { FeeFrequency, AppliesToType } from '../entities/fee-structure.entity';

export class CreateFeeStructureDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsEnum(FeeFrequency)
  frequency: FeeFrequency;

  @IsNotEmpty()
  @IsEnum(AppliesToType)
  applies_to_type: AppliesToType;

  @IsOptional()
  @IsUUID()
  applies_to_id?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
