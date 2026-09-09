import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { PaymentConnectionStatusPayload, StripeConnectService } from './stripe-connect.service';

/**
 * Admin endpoints for a club's payment provider connection.
 *
 * Tenant-scoped like the other admin settings surfaces (same guards and role
 * as AdminController): the club is always the caller's own, resolved from the
 * tenant context, never from client input.
 */
@Controller('admin/settings/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PaymentConnectionsController {
  constructor(
    private readonly stripeConnect: StripeConnectService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Start (or resume) Stripe Connect Express onboarding. Returns the hosted
   * onboarding URL the admin should be redirected to.
   */
  @Post('stripe/connect')
  @HttpCode(HttpStatus.CREATED)
  async connectStripe(): Promise<{ url: string }> {
    return this.stripeConnect.startOnboarding(this.tenantContext.getClubId());
  }

  /**
   * Pull the latest account state from Stripe and persist it. Used by the
   * settings page after the admin returns from onboarding, and any time they
   * want to refresh the status by hand.
   */
  @Post('stripe/sync')
  @HttpCode(HttpStatus.OK)
  async syncStripe(): Promise<PaymentConnectionStatusPayload> {
    return this.stripeConnect.syncForClub(this.tenantContext.getClubId());
  }

  /** The club's current connection status, from persisted state only. */
  @Get('connection')
  async getConnection(): Promise<PaymentConnectionStatusPayload> {
    return this.stripeConnect.getStatusForClub(this.tenantContext.getClubId());
  }
}
