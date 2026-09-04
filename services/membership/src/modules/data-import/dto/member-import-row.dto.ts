import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEmail,
  IsIn,
  MaxLength,
} from 'class-validator';
import { GoverningBody } from '@swim-nexus/shared-types';

// One row of a combined members import (swimmer plus parent/family details).
export class MemberImportRowDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  swimmer_first_name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  swimmer_last_name: string;

  @IsNotEmpty()
  @IsDateString()
  dob: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['M', 'F', 'Male', 'Female'])
  gender: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  se_number?: string;

  @IsOptional()
  @IsIn(Object.values(GoverningBody))
  governing_body?: GoverningBody;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  squad_name?: string;

  @IsOptional()
  @IsString()
  medical_notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  emergency_contact?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  parent_name: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  parent_email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  parent_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  family_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postcode?: string;
}
