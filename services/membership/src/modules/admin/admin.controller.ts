import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ClubSettingsService } from './settings/club-settings.service';
import { UpdateClubSettingsDto } from './settings/dto/update-club-settings.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly clubSettingsService: ClubSettingsService,
  ) {}

  @Get('dashboard')
  async getDashboard(): Promise<DashboardStatsDto> {
    return this.adminService.getDashboardStats();
  }

  @Get('reports')
  async getReports() {
    return this.adminService.getReportsData();
  }

  @Get('settings')
  async getSettings() {
    return this.clubSettingsService.getSettings();
  }

  @Put('settings')
  async updateSettings(@Body() dto: UpdateClubSettingsDto) {
    return this.clubSettingsService.updateSettings(dto);
  }
}
