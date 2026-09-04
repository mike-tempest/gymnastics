import { IsString, IsNotEmpty, IsOptional, IsEmail, IsDateString } from 'class-validator';

export class CreateOfficerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  dbs_number?: string;

  @IsOptional()
  @IsDateString()
  dbs_expiry?: string;

  @IsOptional()
  @IsString()
  qualifications?: string;
}
