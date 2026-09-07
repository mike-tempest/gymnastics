import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateResultDto } from './create-result.dto';

/** All result fields are editable except the member it belongs to. */
export class UpdateResultDto extends PartialType(
  OmitType(CreateResultDto, ['member_id'] as const),
) {}
