import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuditAction, AuditEntityType } from './entities/audit-log.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { UuidParam } from '../../../common/validation/parse-uuid.pipe';

@Controller('compliance/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN) // Only admins can view audit logs
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(@Query('limit') limit?: number, @Query('offset') offset?: number) {
    return this.auditLogsService.findAll(limit || 100, offset || 0);
  }

  @Get('statistics')
  getStatistics() {
    return this.auditLogsService.getStatistics();
  }

  @Get('recent')
  findRecent(@Query('hours') hours?: number) {
    return this.auditLogsService.findRecent(hours ? parseInt(hours.toString()) : 24);
  }

  @Get('user/:userId')
  findByUser(@Param('userId', UuidParam) userId: string, @Query('limit') limit?: number) {
    return this.auditLogsService.findByUser(userId, limit || 100);
  }

  @Get('entity/:entityType/:entityId')
  findByEntity(
    @Param('entityType') entityType: AuditEntityType,
    @Param('entityId', UuidParam) entityId: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditLogsService.findByEntity(entityType, entityId, limit || 100);
  }

  @Get('action/:action')
  findByAction(@Param('action') action: AuditAction, @Query('limit') limit?: number) {
    return this.auditLogsService.findByAction(action, limit || 100);
  }

  @Get('date-range')
  findByDateRange(@Query('start') startDate: string, @Query('end') endDate: string) {
    return this.auditLogsService.findByDateRange(new Date(startDate), new Date(endDate));
  }

  @Get(':id')
  findOne(@Param('id', UuidParam) id: string) {
    return this.auditLogsService.findOne(id);
  }
}
