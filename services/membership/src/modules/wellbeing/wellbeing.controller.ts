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

  @Get('member/:memberId/history')
  getMemberHistory(@Param('memberId') memberId: string, @Query('limit') limit?: number) {
    return this.wellbeingService.getMemberHistory(memberId, limit);
  }

  @Get('member/:memberId/today')
  getTodayCheckIn(@Param('memberId') memberId: string) {
    return this.wellbeingService.getTodayCheckIn(memberId);
  }

  // --- Cycle tracking (parent only, consent-gated in frontend) ---

  @Post('cycle')
  @HttpCode(HttpStatus.CREATED)
  submitCycleLog(@Body() dto: CreateCycleLogDto) {
    return this.wellbeingService.submitCycleLog(dto);
  }

  @Get('cycle/:memberId/history')
  getCycleHistory(@Param('memberId') memberId: string, @Query('limit') limit?: number) {
    return this.wellbeingService.getCycleHistory(memberId, limit);
  }

  @Patch('cycle/:logId')
  updateCycleLog(@Param('logId') logId: string, @Body() dto: UpdateCycleLogDto) {
    if (!dto.member_id) {
      throw new NotFoundException('member_id is required');
    }
    return this.wellbeingService.updateCycleLog(logId, dto.member_id, dto);
  }

  @Delete('cycle/:logId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCycleLog(@Param('logId') logId: string, @Query('member_id') memberId: string) {
    return this.wellbeingService.removeCycleLog(logId, memberId);
  }

  // --- Coach endpoints: readiness only ---

  @Get('readiness')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.SQUAD_COACH, UserRole.WELFARE_OFFICER)
  getSessionReadiness(@Query('member_ids') memberIdsRaw: string, @Query('date') date: string) {
    const memberIds = memberIdsRaw ? memberIdsRaw.split(',') : [];
    return this.wellbeingService.getSessionReadiness(memberIds, date);
  }
}
