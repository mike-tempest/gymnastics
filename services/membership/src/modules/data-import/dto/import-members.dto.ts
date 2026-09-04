import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  ValidateNested,
} from 'class-validator';
import { MemberImportRowDto } from './member-import-row.dto';

export class MemberImportOptionsDto {
  @IsBoolean()
  create_missing_squads: boolean;
}

// Wraps the rows of a combined members import plus import options.
export class ImportMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MemberImportRowDto)
  rows: MemberImportRowDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => MemberImportOptionsDto)
  options: MemberImportOptionsDto;
}
