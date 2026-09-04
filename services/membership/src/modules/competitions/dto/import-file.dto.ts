import { IsOptional, IsIn, IsString } from 'class-validator';
import { FileFormat } from '../../../parsers/parser.interface';

export class ImportFileDto {
  @IsOptional()
  @IsIn(Object.values(FileFormat))
  format?: FileFormat;
}

export class ExportFileDto {
  @IsOptional()
  @IsIn(Object.values(FileFormat))
  @IsString()
  format?: FileFormat;
}
