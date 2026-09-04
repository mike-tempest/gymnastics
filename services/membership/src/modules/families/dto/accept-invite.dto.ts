import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AcceptInviteDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
