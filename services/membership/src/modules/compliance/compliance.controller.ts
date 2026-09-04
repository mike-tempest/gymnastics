import { Controller, Get, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  /**
   * Get compliance summary
   * Returns aggregated statistics from DBS, Consents, and Safeguarding
   * Includes health score, counts, and expiring checks
   * Accessible by admins, head coaches, treasurers, and welfare officers
   */
  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.TREASURER, UserRole.WELFARE_OFFICER)
  getSummary() {
    return this.complianceService.getSummary();
  }
}
