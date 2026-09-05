import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
  MaxLength,
  IsIn,
} from 'class-validator';
import { GoverningBody } from '@club-manager/shared-types';

export class CreateMemberDto {
  @IsOptional()
  @IsUUID()
  family_id?: string;

  @IsOptional()
  @IsUUID()
  club_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  registration_number?: string | null;

  @IsOptional()
  @IsIn(Object.values(GoverningBody))
  governing_body?: GoverningBody | null;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  first_name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  last_name: string;

  @IsNotEmpty()
  @IsDateString()
  dob: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['M', 'F', 'Male', 'Female'])
  gender: string;

  @IsOptional()
  @IsUUID()
  squad_id?: string;

  @IsOptional()
  @IsString()
  medical_notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  emergency_contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photo_url?: string;
}
