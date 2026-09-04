import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';

export class CreateSquadDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  squad_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  min_age?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  max_age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  coach_name?: string;

  @IsOptional()
  @IsString()
  training_times?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_capacity?: number;
}
