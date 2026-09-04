import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

export class UpdateAttendanceDto {
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsDateString()
  checked_in_at?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}
