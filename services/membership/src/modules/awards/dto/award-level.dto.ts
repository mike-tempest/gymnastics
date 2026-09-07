import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAwardLevelDto {
  @IsNotEmpty()
  @IsUUID()
  scheme_id: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  badge_fee?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  certificate_fee?: number | null;

  @IsOptional()
  @IsUUID()
  fee_structure_id?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAwardLevelDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  badge_fee?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  certificate_fee?: number | null;

  @IsOptional()
  @IsUUID()
  fee_structure_id?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
