import { BillingAdjustmentsController } from './billing-adjustments.controller';
import { BillingAdjustmentsService } from './billing-adjustments.service';
import { PaymentOperationsService } from './payment-operations.service';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { UserRole } from '../../users/entities/user.entity';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
const result = {
  family_id: 'family',
  currency: 'GBP',
  balance: { due_minor: 100 },
  credits: [],
  operations: [],
};
const service = { history: jest.fn().mockResolvedValue(result) };
const controller = new BillingAdjustmentsController(
  service as unknown as BillingAdjustmentsService,
  {} as PaymentOperationsService,
  { getClubId: () => 'club' } as TenantContextService,
);
describe('billing adjustment access', () => {
  it('allows a parent to read only their own family balance', async () => {
    await expect(
      controller.history('invoice', {
        user: { user_id: 'parent', role: UserRole.PARENT, family_id: 'family' },
      }),
    ).resolves.toMatchObject({ balance: { due_minor: 100 } });
    await expect(
      controller.history('invoice', {
        user: { user_id: 'parent', role: UserRole.PARENT, family_id: 'other' },
      }),
    ).rejects.toThrow();
    await expect(
      controller.history('invoice', { user: { user_id: 'parent', role: UserRole.PARENT } }),
    ).rejects.toThrow();
  });
  it.each(Object.values(UserRole))('requires exact financial roles for mutations: %s', (role) => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => controller.credit,
      getClass: () => BillingAdjustmentsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(
      [UserRole.SUPER_ADMIN, UserRole.TREASURER].includes(role),
    );
  });
});
