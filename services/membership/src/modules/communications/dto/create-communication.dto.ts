import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RecipientType } from '../entities/communication.entity';

export class CreateCommunicationDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsEnum(RecipientType)
  @IsNotEmpty()
  recipientType: RecipientType;

  @IsUUID()
  @IsOptional()
  squadId?: string;

  @IsUUID()
  @IsOptional()
  familyId?: string;
}
