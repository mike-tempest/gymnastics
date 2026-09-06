import {
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';

export class CreateWellbeingLogDto {
  @IsUUID()
  member_id: string;

  @IsDateString()
  log_date: string;

  @IsInt()
  @Min(1)
  @Max(5)
  energy_level: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  sleep_quality?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  comfort_in_water: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  prefers_land_training?: boolean;
}
