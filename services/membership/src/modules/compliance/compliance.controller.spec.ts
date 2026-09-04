import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ComplianceController', () => {
  let controller: ComplianceController;

  const mockSummary = {
    healthScore: 72,
    totalMembers: 20,
    dbsValid: 15,
    dbsExpiringSoon: 3,
    dbsExpired: 2,
    consentComplete: 14,
    consentPartial: 4,
    consentMissing: 2,
    safeguardingOfficer: {
      name: 'Sarah Mitchell',
      role: 'Club Welfare Officer',
      email: 'welfare@swimclub.org.uk',
      phone: '07700 900123',
      dbsNumber: '001234567890',
      dbsExpiry: '2025-09-15T00:00:00.000Z',
    },
    expiringDbsChecks: [],
  };

  const mockComplianceService = {
    getSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplianceController],
      providers: [{ provide: ComplianceService, useValue: mockComplianceService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ComplianceController>(ComplianceController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return the compliance summary', async () => {
      mockComplianceService.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary();

      expect(result).toEqual(mockSummary);
      expect(mockComplianceService.getSummary).toHaveBeenCalled();
    });

    it('should propagate errors from the compliance service', async () => {
      mockComplianceService.getSummary.mockRejectedValue(new Error('Service error'));

      await expect(controller.getSummary()).rejects.toThrow('Service error');
    });
  });
});
