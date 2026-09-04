import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsIn,
  MaxLength,
} from 'class-validator';
import { VALID_STROKES } from '../../../parsers/parser.interface';

export class CreateEntryDto {
  @IsNotEmpty()
  @IsUUID()
  swimmer_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  event_name?: string;

  @IsNotEmpty()
  @IsNumber()
  distance: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(VALID_STROKES)
  stroke: string;

  @IsOptional()
  @IsNumber()
  entry_time?: number;

  @IsOptional()
  @IsNumber()
  seed_time?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  age_group?: string;
}
