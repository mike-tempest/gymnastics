import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SafeguardingService } from './safeguarding.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { CreateOfficerDto } from './dto/create-officer.dto';
import { UpdateOfficerDto } from './dto/update-officer.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@Controller('compliance/safeguarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SafeguardingController {
  constructor(private readonly safeguardingService: SafeguardingService) {}

  @Get('checklist')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  getChecklist() {
    return this.safeguardingService.getChecklist();
  }

  @Patch('checklist/:id')
  @Roles(UserRole.SUPER_ADMIN)
  updateChecklistItem(@Param('id') id: string, @Body() dto: UpdateChecklistItemDto) {
    return this.safeguardingService.updateChecklistItem(id, dto.completed);
  }

  @Get('officers')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  getOfficers() {
    return this.safeguardingService.getOfficers();
  }

  @Post('officers')
  @Roles(UserRole.SUPER_ADMIN)
  createOfficer(@Body() dto: CreateOfficerDto) {
    return this.safeguardingService.createOfficer(dto);
  }

  @Put('officers/:id')
  @Roles(UserRole.SUPER_ADMIN)
  updateOfficer(@Param('id') id: string, @Body() dto: UpdateOfficerDto) {
    return this.safeguardingService.updateOfficer(id, dto);
  }

  @Delete('officers/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOfficer(@Param('id') id: string) {
    return this.safeguardingService.deleteOfficer(id);
  }

  @Get('incidents')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  getIncidents() {
    return this.safeguardingService.getIncidents();
  }

  @Post('incidents')
  @Roles(UserRole.SUPER_ADMIN)
  createIncident(@Body() createIncidentDto: CreateIncidentDto) {
    return this.safeguardingService.createIncident(createIncidentDto);
  }
}
