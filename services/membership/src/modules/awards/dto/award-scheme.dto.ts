import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, MaxLength } from 'class-validator';
import { AwardSchemeSource } from '@club-manager/shared-types';

export class CreateAwardSchemeDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(AwardSchemeSource)
  source?: AwardSchemeSource;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAwardSchemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(AwardSchemeSource)
  source?: AwardSchemeSource;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
