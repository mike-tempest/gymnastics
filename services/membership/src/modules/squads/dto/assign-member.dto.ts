import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignMemberDto {
  @IsNotEmpty()
  @IsUUID()
  member_id: string;
}
