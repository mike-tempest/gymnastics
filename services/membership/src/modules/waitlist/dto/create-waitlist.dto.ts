import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateWaitlistDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  clubName?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
