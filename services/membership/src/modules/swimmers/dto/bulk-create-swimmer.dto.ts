import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateSwimmerDto } from './create-swimmer.dto';

// Wraps an array of swimmer records for bulk import
export class BulkCreateSwimmerDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSwimmerDto)
  swimmers: CreateSwimmerDto[];
}
