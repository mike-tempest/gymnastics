import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FeeStructuresService } from './fee-structures.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { BulkCreateFeeStructureDto } from './dto/bulk-create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { UuidParam } from '../../../common/validation/parse-uuid.pipe';

@Controller('fee-structures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeeStructuresController {
  constructor(private readonly feeStructuresService: FeeStructuresService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createFeeStructureDto: CreateFeeStructureDto) {
    return this.feeStructuresService.create(createFeeStructureDto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  bulkCreate(@Body() bulkCreateDto: BulkCreateFeeStructureDto) {
    return this.feeStructuresService.bulkCreate(bulkCreateDto.fee_structures);
  }

  @Get()
  findAll() {
    return this.feeStructuresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', UuidParam) id: string) {
    return this.feeStructuresService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id', UuidParam) id: string, @Body() updateFeeStructureDto: UpdateFeeStructureDto) {
    return this.feeStructuresService.update(id, updateFeeStructureDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParam) id: string) {
    return this.feeStructuresService.remove(id);
  }
}
