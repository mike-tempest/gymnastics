import { IsNotEmpty, IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

export class CreateAttendanceDto {
  @IsNotEmpty()
  @IsUUID()
  session_id: string;

  @IsNotEmpty()
  @IsUUID()
  swimmer_id: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
