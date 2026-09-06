import { IsUUID, IsDateString, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateCycleLogDto {
  @IsUUID()
  member_id: string;

  @IsDateString()
  period_start: string;

  @IsOptional()
  @IsDateString()
  period_end?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
