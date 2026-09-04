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
import { SquadsService } from './squads.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';
import { BulkCreateSquadDto } from './dto/bulk-create-squad.dto';
import { AssignSwimmerDto } from './dto/assign-swimmer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('squads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SquadsController {
  constructor(private readonly squadsService: SquadsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  create(@Body() createSquadDto: CreateSquadDto) {
    return this.squadsService.create(createSquadDto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  bulkCreate(@Body() bulkCreateDto: BulkCreateSquadDto) {
    return this.squadsService.bulkCreate(bulkCreateDto.squads);
  }

  @Get()
  findAll() {
    return this.squadsService.findAll();
  }

  @Get('statistics')
  getStatistics() {
    return this.squadsService.getStatistics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.squadsService.findOne(id);
  }

  @Get(':id/swimmers')
  getSwimmers(@Param('id') id: string) {
    return this.squadsService.getSwimmersBySquad(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  update(@Param('id') id: string, @Body() updateSquadDto: UpdateSquadDto) {
    return this.squadsService.update(id, updateSquadDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.squadsService.remove(id);
  }

  @Post(':id/swimmers')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  assignSwimmer(@Param('id') id: string, @Body() assignSwimmerDto: AssignSwimmerDto) {
    return this.squadsService.assignSwimmer(id, assignSwimmerDto.swimmer_id);
  }

  @Delete(':id/swimmers/:swimmerId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  removeSwimmer(@Param('id') id: string, @Param('swimmerId') swimmerId: string) {
    return this.squadsService.removeSwimmer(id, swimmerId);
  }
}
