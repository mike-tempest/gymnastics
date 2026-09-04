import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { WellbeingService } from './wellbeing.service';
import { CreateWellbeingLogDto } from './dto/create-wellbeing-log.dto';
import { CreateCycleLogDto } from './dto/create-cycle-log.dto';
import { UpdateCycleLogDto } from './dto/update-cycle-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('wellbeing')
@UseGuards(JwtAuthGuard)
export class WellbeingController {
  constructor(private readonly wellbeingService: WellbeingService) {}

  // --- Parent endpoints ---

  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  submitCheckIn(@Body() dto: CreateWellbeingLogDto) {
    return this.wellbeingService.submitCheckIn(dto);
  }

  @Get('swimmer/:swimmerId/history')
  getSwimmerHistory(@Param('swimmerId') swimmerId: string, @Query('limit') limit?: number) {
    return this.wellbeingService.getSwimmerHistory(swimmerId, limit);
  }

  @Get('swimmer/:swimmerId/today')
  getTodayCheckIn(@Param('swimmerId') swimmerId: string) {
    return this.wellbeingService.getTodayCheckIn(swimmerId);
  }

  // --- Cycle tracking (parent only, consent-gated in frontend) ---

  @Post('cycle')
  @HttpCode(HttpStatus.CREATED)
  submitCycleLog(@Body() dto: CreateCycleLogDto) {
    return this.wellbeingService.submitCycleLog(dto);
  }

  @Get('cycle/:swimmerId/history')
  getCycleHistory(@Param('swimmerId') swimmerId: string, @Query('limit') limit?: number) {
    return this.wellbeingService.getCycleHistory(swimmerId, limit);
  }

  @Patch('cycle/:logId')
  updateCycleLog(@Param('logId') logId: string, @Body() dto: UpdateCycleLogDto) {
    if (!dto.swimmer_id) {
      throw new NotFoundException('swimmer_id is required');
    }
    return this.wellbeingService.updateCycleLog(logId, dto.swimmer_id, dto);
  }

  @Delete('cycle/:logId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCycleLog(@Param('logId') logId: string, @Query('swimmer_id') swimmerId: string) {
    return this.wellbeingService.removeCycleLog(logId, swimmerId);
  }

  // --- Coach endpoints: readiness only ---

  @Get('readiness')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.SQUAD_COACH, UserRole.WELFARE_OFFICER)
  getSessionReadiness(@Query('swimmer_ids') swimmerIdsRaw: string, @Query('date') date: string) {
    const swimmerIds = swimmerIdsRaw ? swimmerIdsRaw.split(',') : [];
    return this.wellbeingService.getSessionReadiness(swimmerIds, date);
  }
}
