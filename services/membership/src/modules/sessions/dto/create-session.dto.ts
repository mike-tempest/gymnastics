import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
  MaxLength,
  IsInt,
  IsEnum,
  Matches,
} from 'class-validator';
import { SessionStatus } from '../entities/session.entity';

export class CreateSessionDto {
  @IsOptional()
  @IsUUID()
  squad_id?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  session_name: string;

  @IsNotEmpty()
  @IsDateString()
  session_date: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'start_time must be in HH:MM format',
  })
  start_time: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'end_time must be in HH:MM format',
  })
  end_time: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  coach_name?: string;

  @IsOptional()
  @IsInt()
  max_participants?: number;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}
