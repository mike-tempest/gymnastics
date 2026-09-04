import { PartialType } from '@nestjs/mapped-types';
import { CreateConsentDto } from './create-consent.dto';
import { IsEnum, IsDateString, IsUUID, IsOptional } from 'class-validator';
import { ConsentStatus } from '../entities/consent.entity';

export class UpdateConsentDto extends PartialType(CreateConsentDto) {
  @IsEnum(ConsentStatus)
  @IsOptional()
  status?: ConsentStatus;

  @IsDateString()
  @IsOptional()
  revoked_date?: string;

  @IsUUID()
  @IsOptional()
  revoked_by_user_id?: string;
}
