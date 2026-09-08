import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { CredentialStatus } from '@club-manager/shared-types';
import { CreateCredentialDto } from './create-credential.dto';

/**
 * Every create field is optional on update. Status is settable so a welfare
 * officer can correct a record by hand, but any change to expiry_date has the
 * derived status applied on top, exactly as the background-check module does.
 *
 * expiry_date is redeclared rather than inherited so it can be null: a
 * credential wrongly recorded as expiring has to be correctable to one that
 * never does. IsOptional skips null as well as undefined, so an explicit null
 * passes validation and clears the column.
 */
export class UpdateCredentialDto extends PartialType(
  OmitType(CreateCredentialDto, ['expiry_date'] as const),
) {
  @IsEnum(CredentialStatus)
  @IsOptional()
  status?: CredentialStatus;

  @IsDateString()
  @IsOptional()
  expiry_date?: string | null;
}
