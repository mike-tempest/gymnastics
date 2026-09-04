import { PartialType } from '@nestjs/mapped-types';
import { CreateSwimmerDto } from './create-swimmer.dto';

export class UpdateSwimmerDto extends PartialType(CreateSwimmerDto) {}
