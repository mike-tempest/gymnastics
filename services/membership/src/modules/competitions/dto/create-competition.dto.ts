import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
  IsIn,
  IsInt,
  IsNumber,
  IsArray,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CompetitionType, CompetitionStatus, CourseType } from '../entities/competition.entity';
import { VALID_STROKES } from '../../../parsers/parser.interface';

export class QualifyingTimeDto {
  @IsInt()
  @Min(1)
  distance: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(VALID_STROKES)
  stroke: string;

  @IsNumber()
  @Min(0)
  time: number;
}

export class CreateCompetitionDto {
  @IsOptional()
  @IsUUID()
  club_id?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organiser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  venue?: string;

  @IsNotEmpty()
  @IsDateString()
  start_date: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsIn(Object.values(CompetitionType))
  type?: CompetitionType;

  @IsOptional()
  @IsIn(Object.values(CourseType))
  course?: CourseType;

  @IsOptional()
  @IsIn(Object.values(CompetitionStatus))
  status?: CompetitionStatus;

  @IsOptional()
  @IsDateString()
  entry_deadline?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualifyingTimeDto)
  qualifying_times?: QualifyingTimeDto[];
}
