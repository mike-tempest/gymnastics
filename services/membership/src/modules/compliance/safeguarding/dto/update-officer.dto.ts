import { PartialType } from '@nestjs/mapped-types';
import { CreateOfficerDto } from './create-officer.dto';

export class UpdateOfficerDto extends PartialType(CreateOfficerDto) {}
