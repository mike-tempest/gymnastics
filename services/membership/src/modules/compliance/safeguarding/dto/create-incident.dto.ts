import { IsString, IsDateString, IsEnum, IsNotEmpty } from 'class-validator';
import { IncidentStatus } from '../entities/incident.entity';

export class CreateIncidentDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsEnum(IncidentStatus)
  status: IncidentStatus;

  @IsString()
  @IsNotEmpty()
  reported_by: string;
}
