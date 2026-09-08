import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CredentialType } from '@club-manager/shared-types';

/**
 * Exactly one subject: a user (the usual case, a coach or volunteer) or a
 * member. ValidateIf makes each id required only when the other is absent, so
 * a payload carrying neither is rejected here. A payload carrying both is
 * rejected by CredentialsService, which is where the either/or rule is
 * enforced; the database check constraint is the backstop.
 */
export class CreateCredentialDto {
  @ValidateIf((dto: CreateCredentialDto) => !dto.member_id)
  @IsUUID()
  user_id?: string;

  @ValidateIf((dto: CreateCredentialDto) => !dto.user_id)
  @IsUUID()
  member_id?: string;

  @IsEnum(CredentialType)
  credential_type: CredentialType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  issuing_body?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  reference_number?: string;

  @IsDateString()
  issue_date: string;

  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  document_reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
