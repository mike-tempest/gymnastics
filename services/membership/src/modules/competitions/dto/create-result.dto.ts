import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  IsIn,
  IsBoolean,
  IsArray,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { VALID_STROKES } from '../../../parsers/parser.interface';
import { CourseType } from '../entities/competition.entity';

export class RelayLegDto {
  @IsInt()
  @Min(1)
  leg: number;

  @IsOptional()
  @IsUUID()
  swimmer_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  split?: number;
}

export class CreateResultDto {
  @IsNotEmpty()
  @IsUUID()
  swimmer_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  event_name?: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  distance: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(VALID_STROKES)
  stroke: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  time: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  place?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  heat?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lane?: number;

  @IsOptional()
  @IsBoolean()
  dq?: boolean;

  @IsOptional()
  @IsString()
  dq_reason?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  splits?: number[];

  @IsOptional()
  @IsIn(Object.values(CourseType))
  course?: CourseType;

  @IsOptional()
  @IsBoolean()
  is_relay?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelayLegDto)
  relay_legs?: RelayLegDto[];
}
