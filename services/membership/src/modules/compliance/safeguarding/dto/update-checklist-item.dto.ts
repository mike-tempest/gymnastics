import { IsBoolean } from 'class-validator';

export class UpdateChecklistItemDto {
  @IsBoolean()
  completed: boolean;
}
