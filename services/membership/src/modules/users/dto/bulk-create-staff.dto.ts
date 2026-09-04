import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

// A single staff record within a bulk import payload. No password is accepted:
// the server generates a random one and staff set their own via password reset.
export class BulkCreateStaffItemDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsEnum(UserRole)
  role: UserRole;
}

// Wraps an array of staff records for bulk import
export class BulkCreateStaffDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkCreateStaffItemDto)
  users: BulkCreateStaffItemDto[];
}
