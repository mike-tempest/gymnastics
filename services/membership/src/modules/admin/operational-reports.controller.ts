import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { OperationalReportsService } from './operational-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExactRoles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
@Controller('admin/reports/operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ExactRoles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
export class OperationalReportsController {
  constructor(private readonly reports: OperationalReportsService) {}
  @Get() summary(@Query() query: unknown) {
    return this.reports.summary(query);
  }
  @Get('records') records(@Query() query: unknown) {
    return this.reports.details(query);
  }
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="operational-report.csv"')
  export(@Query() query: unknown) {
    return this.reports.export(query);
  }
}
