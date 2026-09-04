import { IsString, IsEnum, IsDateString, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { DBSCheckType } from '../entities/dbs-check.entity';

export class CreateDBSCheckDto {
  @IsUUID()
  user_id: string;

  @IsString()
  certificate_number: string;

  @IsEnum(DBSCheckType)
  check_type: DBSCheckType;

  @IsDateString()
  issue_date: string;

  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  is_valid?: boolean;

  @IsUUID()
  @IsOptional()
  uploaded_document_id?: string;
}
