import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { UuidParam } from '../../../common/validation/parse-uuid.pipe';
import { BillingAdjustmentsService } from './billing-adjustments.service';
import { PaymentOperationsService } from './payment-operations.service';
import {
  allocationSchema,
  creditSchema,
  parse,
  policyVersionSchema,
  revisionSchema,
  runSchema,
} from './billing.schemas';
import { minor } from './billing-calculator';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const refund = z
  .object({
    payment_id: z.string().uuid(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
type RequestUser = { user: { user_id: string; role: UserRole; family_id?: string } };

@Controller('billing-adjustments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
@SetMetadata('exactRoles', true)
export class BillingAdjustmentsController {
  constructor(
    private readonly service: BillingAdjustmentsService,
    private readonly operations: PaymentOperationsService,
    private readonly tenant: TenantContextService,
  ) {}
  @Get('configuration') configuration() {
    return this.service.configuration(this.tenant.getClubId());
  }
  @Post('policies') policy(@Req() req: RequestUser, @Body() body: unknown) {
    return this.service.savePolicy(
      this.tenant.getClubId(),
      req.user.user_id,
      parse(policyVersionSchema, body),
    );
  }
  @Post('fees/:id/revisions') revision(
    @Param('id', UuidParam) id: string,
    @Req() req: RequestUser,
    @Body() body: unknown,
  ) {
    return this.service.reviseFee(
      this.tenant.getClubId(),
      req.user.user_id,
      id,
      parse(revisionSchema, body),
    );
  }
  @Post('preview') preview(@Body() body: unknown) {
    return this.service.preview(this.tenant.getClubId(), parse(runSchema, body));
  }
  @Post('generate') generate(@Req() req: RequestUser, @Body() body: unknown) {
    const input = parse(z.object({ input: runSchema, preview_hash: hash }).strict(), body);
    return this.service.generate(
      this.tenant.getClubId(),
      req.user.user_id,
      input.input,
      input.preview_hash,
    );
  }
  @Get('invoices/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER, UserRole.PARENT, UserRole.MEMBER_ADULT)
  async history(@Param('id', UuidParam) id: string, @Req() req: RequestUser) {
    const result = await this.service.history(this.tenant.getClubId(), id);
    if (![UserRole.SUPER_ADMIN, UserRole.TREASURER].includes(req.user.role)) {
      if (!req.user.family_id || req.user.family_id !== result.family_id)
        throw new ForbiddenException();
      return {
        invoice_id: id,
        currency: result.currency,
        balance: result.balance,
        credits: result.credits.map((c: Record<string, unknown>) => ({
          credit_id: c.credit_id,
          kind: c.kind,
          amount_minor: c.amount_minor,
          reason: c.reason,
          created_at: c.created_at,
        })),
        operations: result.operations.map((o: Record<string, unknown>) => ({
          kind: o.kind,
          amount_minor: o.amount_minor,
          state: o.state,
          created_at: o.created_at,
        })),
      };
    }
    return result;
  }
  @Post('invoices/:id/credits/preview') creditPreview(
    @Param('id', UuidParam) id: string,
    @Body() body: unknown,
  ) {
    return this.service.creditPreview(this.tenant.getClubId(), id, parse(creditSchema, body));
  }
  @Post('invoices/:id/credits') credit(
    @Param('id', UuidParam) id: string,
    @Req() req: RequestUser,
    @Body() body: unknown,
  ) {
    const input = parse(z.object({ input: creditSchema, preview_hash: hash }).strict(), body);
    return this.service.credit(
      this.tenant.getClubId(),
      req.user.user_id,
      id,
      input.input,
      input.preview_hash,
    );
  }
  @Post('invoices/:id/credits/:creditId/reverse') reverse(
    @Param('id', UuidParam) id: string,
    @Param('creditId', UuidParam) creditId: string,
    @Req() req: RequestUser,
    @Body() body: unknown,
  ) {
    const input = parse(z.object({ reason: z.string().trim().min(5).max(500) }).strict(), body);
    return this.service.reverse(
      this.tenant.getClubId(),
      req.user.user_id,
      id,
      creditId,
      input.reason,
    );
  }
  @Post('invoices/:id/allocate') allocate(
    @Param('id', UuidParam) id: string,
    @Req() req: RequestUser,
    @Body() body: unknown,
  ) {
    const input = parse(allocationSchema, body);
    return this.service.allocate(
      this.tenant.getClubId(),
      req.user.user_id,
      id,
      input.target_invoice_id,
      minor(input.amount),
      input.source_event,
    );
  }
  @Post('invoices/:id/refunds/preview') refundPreview(
    @Param('id', UuidParam) id: string,
    @Body() body: unknown,
  ) {
    const input = parse(refund, body);
    return this.operations.refundPreview(
      this.tenant.getClubId(),
      id,
      input.payment_id,
      minor(input.amount),
      input.reason,
    );
  }
  @Post('invoices/:id/refunds') refund(
    @Param('id', UuidParam) id: string,
    @Req() req: RequestUser,
    @Body() body: unknown,
  ) {
    const input = parse(
      z.object({ input: refund, operation_id: z.string().uuid(), preview_hash: hash }).strict(),
      body,
    );
    return this.operations.refund(
      this.tenant.getClubId(),
      req.user.user_id,
      id,
      input.input.payment_id,
      minor(input.input.amount),
      input.input.reason,
      input.operation_id,
      input.preview_hash,
    );
  }
  @Post('operations/:id/reconcile') reconcile(@Param('id', UuidParam) id: string) {
    return this.operations.reconcile(this.tenant.getClubId(), id);
  }
}
