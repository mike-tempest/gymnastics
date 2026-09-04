import { PartialType } from '@nestjs/mapped-types';
import { CreateMandateDto } from './create-mandate.dto';

export class UpdateMandateDto extends PartialType(CreateMandateDto) {}
