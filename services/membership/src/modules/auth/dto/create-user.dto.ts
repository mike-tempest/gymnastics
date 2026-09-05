import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsUUID,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { UserRole } from '@club-manager/shared-types';

export class CreateUserDto {
  @IsNotEmpty()
  @IsUUID()
  club_id: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  first_name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  last_name: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;
}
