import { PartialType } from '@nestjs/mapped-types';
import { CreateCycleLogDto } from './create-cycle-log.dto';

export class UpdateCycleLogDto extends PartialType(CreateCycleLogDto) {}
