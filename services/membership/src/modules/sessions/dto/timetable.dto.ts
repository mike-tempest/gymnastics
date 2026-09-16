import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SeriesDefinitionDto {
  @IsUUID() squad_id: string;
  @IsString() @MaxLength(200) session_name: string;
  @IsInt() @Min(0) @Max(6) weekday: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start_time: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end_time: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(100) coach_name?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) max_participants?: number;
  @IsArray()
  @ArrayMaxSize(366)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  excluded_dates: string[];
}

export class TimetableDto {
  @IsString() @MaxLength(200) name: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) start_date: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) end_date: string;
  @IsOptional() @IsUUID() source_term_id?: string;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SeriesDefinitionDto)
  series: SeriesDefinitionDto[];
  @IsOptional() @IsUUID() operation_id?: string;
  @IsOptional() @IsString() @MaxLength(64) preview_token?: string;
}

export class EditOccurrenceDto {
  @IsIn(['one', 'future']) scope: 'one' | 'future';
  @IsDefined() @ValidateNested() @Type(() => SeriesDefinitionDto) definition: SeriesDefinitionDto;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) session_date?: string;
}
