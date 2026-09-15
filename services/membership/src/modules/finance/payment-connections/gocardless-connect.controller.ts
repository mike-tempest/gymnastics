import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { GoCardlessConnectService } from './gocardless-connect.service';

export class CompleteGoCardlessConnectionDto {
  @IsString() @Length(1, 2048) code: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) state: string;
}

@Controller('admin/settings/payments/gocardless')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class GoCardlessConnectController {
  constructor(
    private readonly service: GoCardlessConnectService,
    private readonly tenant: TenantContextService,
  ) {}
  @Get('connection') status() {
    return this.service.getStatus(this.tenant.getClubId());
  }
  @Post('connect') start(@Req() req: { user: { user_id: string } }) {
    return this.service.start(this.tenant.getClubId(), req.user.user_id);
  }
  @Post('complete') complete(
    @Req() req: { user: { user_id: string } },
    @Body() dto: CompleteGoCardlessConnectionDto,
  ) {
    return this.service.complete(this.tenant.getClubId(), req.user.user_id, dto.code, dto.state);
  }
  @Post('sync') sync() {
    return this.service.sync(this.tenant.getClubId());
  }
  @Post('disconnect') disconnect() {
    return this.service.disconnect(this.tenant.getClubId());
  }
  @Post('reconcile-mandates') reconcile() {
    return this.service.reconcileMandates(this.tenant.getClubId());
  }
}
