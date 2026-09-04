import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';

export class UpdateParentProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  primary_contact_name?: string;

  @IsOptional()
  @IsEmail()
  primary_contact_email?: string;

  @IsOptional()
  @IsString()
  primary_contact_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address_line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address_line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  postcode?: string;
}
