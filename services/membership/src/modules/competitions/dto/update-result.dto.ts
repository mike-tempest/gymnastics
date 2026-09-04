import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateResultDto } from './create-result.dto';

/** All result fields are editable except the swimmer it belongs to. */
export class UpdateResultDto extends PartialType(
  OmitType(CreateResultDto, ['swimmer_id'] as const),
) {}
