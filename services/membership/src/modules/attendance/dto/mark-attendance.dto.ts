import { IsNotEmpty, IsArray, IsUUID, IsEnum } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

export class MarkAttendanceDto {
  @IsNotEmpty()
  @IsArray()
  @IsUUID('4', { each: true })
  swimmer_ids: string[];

  @IsNotEmpty()
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}
