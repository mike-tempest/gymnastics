import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FeeFrequency, AppliesToType } from '../entities/fee-structure.entity';

// A single fee structure row within a bulk import. Unlike CreateFeeStructureDto,
// bulk rows reference squads by name (resolved server-side) and only support
// club and squad scopes; member-level fees must be created individually.
export class BulkFeeStructureItemDto {
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

  @IsIn([AppliesToType.CLUB, AppliesToType.SQUAD])
  applies_to_type: AppliesToType.CLUB | AppliesToType.SQUAD;

  // Required when applies_to_type is squad; ignored for club-level fees.
  @IsOptional()
  @IsString()
  squad_name?: string;
}

// Wraps an array of fee structure records for bulk import
export class BulkCreateFeeStructureDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkFeeStructureItemDto)
  fee_structures: BulkFeeStructureItemDto[];
}
