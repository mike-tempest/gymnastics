import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class CreateFamilyDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  family_name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  primary_contact_name: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  primary_contact_email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primary_contact_phone?: string;

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
