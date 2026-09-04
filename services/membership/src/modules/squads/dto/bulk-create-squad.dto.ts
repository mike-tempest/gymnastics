import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateSquadDto } from './create-squad.dto';

// Wraps an array of squad records for bulk import
export class BulkCreateSquadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSquadDto)
  squads: CreateSquadDto[];
}
