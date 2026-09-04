import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignSwimmerDto {
  @IsNotEmpty()
  @IsUUID()
  swimmer_id: string;
}
