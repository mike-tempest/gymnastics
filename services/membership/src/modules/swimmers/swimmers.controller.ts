import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SwimmersService } from './swimmers.service';
import { CreateSwimmerDto } from './dto/create-swimmer.dto';
import { UpdateSwimmerDto } from './dto/update-swimmer.dto';
import { BulkCreateSwimmerDto } from './dto/bulk-create-swimmer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('swimmers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SwimmersController {
  constructor(private readonly swimmersService: SwimmersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  create(@Body() createSwimmerDto: CreateSwimmerDto) {
    return this.swimmersService.create(createSwimmerDto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  bulkCreate(@Body() bulkCreateDto: BulkCreateSwimmerDto) {
    return this.swimmersService.bulkCreate(bulkCreateDto.swimmers);
  }

  @Get()
  findAll(@Query('family_id') familyId?: string, @Query('squad_id') squadId?: string) {
    // Note: any `?club_id=` query param is intentionally ignored. The club is
    // always taken from the authenticated tenant context, so a caller cannot
    // request another club's swimmers by supplying its id. findAll() and all
    // other reads below are already scoped to the active club.
    if (familyId) {
      return this.swimmersService.findByFamilyId(familyId);
    }
    if (squadId) {
      return this.swimmersService.findBySquadId(squadId);
    }
    return this.swimmersService.findAll();
  }

  @Get('statistics')
  getStatistics() {
    return this.swimmersService.getStatistics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.swimmersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  update(@Param('id') id: string, @Body() updateSwimmerDto: UpdateSwimmerDto) {
    return this.swimmersService.update(id, updateSwimmerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.swimmersService.remove(id);
  }
}
