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
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionStatus } from './entities/session.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OptionalUuidParam, UuidParam } from '../../common/validation/parse-uuid.pipe';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  create(@Body() createSessionDto: CreateSessionDto) {
    return this.sessionsService.create(createSessionDto);
  }

  @Get()
  findAll(
    @Query('squad_id', OptionalUuidParam) squadId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    if (squadId) {
      return this.sessionsService.getSessionsBySquad(squadId);
    }
    if (startDate && endDate) {
      return this.sessionsService.getSessionsByDateRange(new Date(startDate), new Date(endDate));
    }
    return this.sessionsService.findAll();
  }

  @Get('upcoming')
  getUpcoming(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : undefined;
    return this.sessionsService.getUpcomingSessions(limitNumber);
  }

  @Get('recent')
  getRecent(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days, 10) : undefined;
    return this.sessionsService.getRecentSessions(daysNumber);
  }

  @Get('squad/:squadId')
  getBySquad(@Param('squadId', UuidParam) squadId: string) {
    return this.sessionsService.getSessionsBySquad(squadId);
  }

  @Get('statistics')
  getStatistics() {
    return this.sessionsService.getStatistics();
  }

  @Get(':id')
  findOne(@Param('id', UuidParam) id: string) {
    return this.sessionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  update(@Param('id', UuidParam) id: string, @Body() updateSessionDto: UpdateSessionDto) {
    return this.sessionsService.update(id, updateSessionDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  updateStatus(@Param('id', UuidParam) id: string, @Body('status') status: SessionStatus) {
    return this.sessionsService.updateSessionStatus(id, status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParam) id: string) {
    return this.sessionsService.remove(id);
  }
}
