import { PartialType } from '@nestjs/mapped-types';
import { CreateDBSCheckDto } from './create-dbs-check.dto';
import { IsEnum, IsDateString, IsOptional } from 'class-validator';
import { DBSStatus } from '../entities/dbs-check.entity';

export class UpdateDBSCheckDto extends PartialType(CreateDBSCheckDto) {
  @IsEnum(DBSStatus)
  @IsOptional()
  status?: DBSStatus;

  @IsDateString()
  @IsOptional()
  last_verified_date?: string;
}
