import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

describe('FinanceController', () => {
  let controller: FinanceController;

  const mockDashboardStats = {
    outstanding_total: 1250.5,
    collected_this_month: 3400,
    overdue_invoices: 3,
  };

  const mockFinanceService = {
    getDashboardStats: jest.fn().mockResolvedValue(mockDashboardStats),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [{ provide: FinanceService, useValue: mockFinanceService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FinanceController>(FinanceController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('authentication and authorisation', () => {
    it('applies JwtAuthGuard and RolesGuard at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', FinanceController);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('restricts the dashboard to admin-level roles', () => {
      const roles = Reflect.getMetadata('roles', FinanceController.prototype.getDashboard);
      expect(roles).toEqual([UserRole.SUPER_ADMIN]);
    });
  });

  describe('getDashboard', () => {
    it('returns the dashboard stats from the service', async () => {
      await expect(controller.getDashboard()).resolves.toEqual(mockDashboardStats);
      expect(mockFinanceService.getDashboardStats).toHaveBeenCalledTimes(1);
    });
  });
});
