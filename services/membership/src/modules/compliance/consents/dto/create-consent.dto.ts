import {
  IsUUID,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { ConsentType, ConsentStatus } from '../entities/consent.entity';

export class CreateConsentDto {
  @IsUUID()
  member_id: string;

  @IsEnum(ConsentType)
  consent_type: ConsentType;

  @IsEnum(ConsentStatus)
  @IsOptional()
  status?: ConsentStatus;

  @IsUUID()
  granted_by_user_id: string;

  @IsDateString()
  @IsOptional()
  granted_date?: string;

  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  specific_conditions?: string;

  @IsBoolean()
  @IsOptional()
  requires_annual_renewal?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
