import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from './compliance.service';
import { DBSService } from './dbs/dbs.service';
import { ConsentsService } from './consents/consents.service';
import { SafeguardingService } from './safeguarding/safeguarding.service';

describe('ComplianceService', () => {
  let service: ComplianceService;

  const mockDbsStats = {
    total: 20,
    valid: 15,
    expiringSoon: 3,
    expired: 2,
    pending: 0,
  };

  const mockConsentStats = {
    total: 60,
    granted: 45,
    denied: 5,
    pending: 8,
    revoked: 2,
    byType: {},
  };

  const mockOfficers = [
    {
      id: 'officer-1',
      name: 'Sarah Mitchell',
      role: 'Club Welfare Officer',
      email: 'welfare@swimclub.org.uk',
      phone: '07700 900123',
      dbs_number: '001234567890',
      dbs_expiry: new Date('2025-09-15'),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const mockExpiringDbs = [
    {
      dbs_check_id: 'dbs-1',
      user_id: 'user-1',
      user: { first_name: 'John', last_name: 'Smith', role: 'head_coach' },
      expiry_date: futureDate,
      certificate_number: 'DBS123',
    },
  ];

  const mockDBSService = {
    getStatistics: jest.fn(),
    getExpiringSoon: jest.fn(),
  };

  const mockConsentsService = {
    getStatistics: jest.fn(),
  };

  const mockSafeguardingService = {
    getOfficers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: DBSService, useValue: mockDBSService },
        { provide: ConsentsService, useValue: mockConsentsService },
        { provide: SafeguardingService, useValue: mockSafeguardingService },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return a compliance summary with aggregated data', async () => {
      mockDBSService.getStatistics.mockResolvedValue(mockDbsStats);
      mockConsentsService.getStatistics.mockResolvedValue(mockConsentStats);
      mockSafeguardingService.getOfficers.mockResolvedValue(mockOfficers);
      mockDBSService.getExpiringSoon.mockResolvedValue(mockExpiringDbs);

      const result = await service.getSummary();

      expect(result).toBeDefined();
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.totalMembers).toBe(mockDbsStats.total);
      expect(result.dbsValid).toBe(mockDbsStats.valid);
      expect(result.dbsExpiringSoon).toBe(mockDbsStats.expiringSoon);
      expect(result.dbsExpired).toBe(mockDbsStats.expired);
    });

    it('should include the primary safeguarding officer', async () => {
      mockDBSService.getStatistics.mockResolvedValue(mockDbsStats);
      mockConsentsService.getStatistics.mockResolvedValue(mockConsentStats);
      mockSafeguardingService.getOfficers.mockResolvedValue(mockOfficers);
      mockDBSService.getExpiringSoon.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.safeguardingOfficer).toBeDefined();
      expect(result.safeguardingOfficer?.name).toBe('Sarah Mitchell');
      expect(result.safeguardingOfficer?.role).toBe('Club Welfare Officer');
      expect(result.safeguardingOfficer?.email).toBe('welfare@swimclub.org.uk');
    });

    it('should set safeguardingOfficer to null when no officers exist', async () => {
      mockDBSService.getStatistics.mockResolvedValue(mockDbsStats);
      mockConsentsService.getStatistics.mockResolvedValue(mockConsentStats);
      mockSafeguardingService.getOfficers.mockResolvedValue([]);
      mockDBSService.getExpiringSoon.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.safeguardingOfficer).toBeNull();
    });

    it('should include expiring DBS checks in the summary', async () => {
      mockDBSService.getStatistics.mockResolvedValue(mockDbsStats);
      mockConsentsService.getStatistics.mockResolvedValue(mockConsentStats);
      mockSafeguardingService.getOfficers.mockResolvedValue(mockOfficers);
      mockDBSService.getExpiringSoon.mockResolvedValue(mockExpiringDbs);

      const result = await service.getSummary();

      expect(result.expiringDbsChecks).toBeDefined();
      expect(result.expiringDbsChecks.length).toBe(1);
      expect(result.expiringDbsChecks[0].name).toBe('John Smith');
      expect(result.expiringDbsChecks[0].daysRemaining).toBeGreaterThanOrEqual(0);
    });

    it('should calculate a health score of 0 when there are no records', async () => {
      mockDBSService.getStatistics.mockResolvedValue({
        total: 0,
        valid: 0,
        expiringSoon: 0,
        expired: 0,
        pending: 0,
      });
      mockConsentsService.getStatistics.mockResolvedValue({
        total: 0,
        granted: 0,
        denied: 0,
        pending: 0,
        revoked: 0,
        byType: {},
      });
      mockSafeguardingService.getOfficers.mockResolvedValue([]);
      mockDBSService.getExpiringSoon.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.healthScore).toBe(0);
    });

    it('should fetch DBS checks expiring within 90 days', async () => {
      mockDBSService.getStatistics.mockResolvedValue(mockDbsStats);
      mockConsentsService.getStatistics.mockResolvedValue(mockConsentStats);
      mockSafeguardingService.getOfficers.mockResolvedValue(mockOfficers);
      mockDBSService.getExpiringSoon.mockResolvedValue([]);

      await service.getSummary();

      expect(mockDBSService.getExpiringSoon).toHaveBeenCalledWith(90);
    });

    it('should re-throw errors from sub-services', async () => {
      mockDBSService.getStatistics.mockRejectedValue(new Error('Database error'));
      mockConsentsService.getStatistics.mockResolvedValue(mockConsentStats);
      mockSafeguardingService.getOfficers.mockResolvedValue(mockOfficers);
      mockDBSService.getExpiringSoon.mockResolvedValue([]);

      await expect(service.getSummary()).rejects.toThrow('Database error');
    });
  });
});
