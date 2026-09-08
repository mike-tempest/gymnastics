import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from './compliance.service';
import { DBSService } from './dbs/dbs.service';
import { ConsentsService } from './consents/consents.service';
import { SafeguardingService } from './safeguarding/safeguarding.service';
import { MembersService } from '../members/members.service';

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

  // 20 members: 12 with every required consent, 5 with some, 3 with none.
  const mockConsentCoverage = { requiredTypes: 3, complete: 12, partial: 5 };
  const mockMemberStats = { total: 20 };

  function daysFromNow(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  const mockOfficers = [
    {
      id: 'officer-1',
      name: 'Sarah Mitchell',
      role: 'Welfare Officer',
      email: 'welfare@gymclub.org.uk',
      phone: '07700 900123',
      dbs_number: '001234567890',
      dbs_expiry: daysFromNow(400),
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'officer-2',
      name: 'Aled Prosser',
      role: 'Deputy Welfare Officer',
      email: 'deputy@gymclub.org.uk',
      phone: null,
      dbs_number: null,
      dbs_expiry: daysFromNow(30),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const mockExpiringDbs = [
    {
      dbs_check_id: 'dbs-1',
      user_id: 'user-1',
      user: { first_name: 'John', last_name: 'Smith', role: 'head_coach' },
      expiry_date: daysFromNow(30),
      certificate_number: 'DBS123',
    },
  ];

  const mockDBSService = {
    getStatistics: jest.fn(),
    getExpiringSoon: jest.fn(),
  };

  const mockConsentsService = {
    getStatistics: jest.fn(),
    getCoverage: jest.fn(),
  };

  const mockSafeguardingService = {
    getOfficers: jest.fn(),
  };

  const mockMembersService = {
    getStatistics: jest.fn(),
  };

  /** Every dependency answering with the happy-path fixtures above. */
  function stubHappyPath() {
    mockDBSService.getStatistics.mockResolvedValue(mockDbsStats);
    mockDBSService.getExpiringSoon.mockResolvedValue(mockExpiringDbs);
    mockConsentsService.getStatistics.mockResolvedValue(mockConsentStats);
    mockConsentsService.getCoverage.mockResolvedValue(mockConsentCoverage);
    mockMembersService.getStatistics.mockResolvedValue(mockMemberStats);
    mockSafeguardingService.getOfficers.mockResolvedValue(mockOfficers);
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: DBSService, useValue: mockDBSService },
        { provide: ConsentsService, useValue: mockConsentsService },
        { provide: SafeguardingService, useValue: mockSafeguardingService },
        { provide: MembersService, useValue: mockMembersService },
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
      stubHappyPath();

      const result = await service.getSummary();

      expect(result).toBeDefined();
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.dbsValid).toBe(mockDbsStats.valid);
      expect(result.dbsExpiringSoon).toBe(mockDbsStats.expiringSoon);
      expect(result.dbsExpired).toBe(mockDbsStats.expired);
    });

    it('should report the club member total, not the DBS check count', async () => {
      stubHappyPath();

      const result = await service.getSummary();

      expect(result.totalMembers).toBe(mockMemberStats.total);
      expect(mockMembersService.getStatistics).toHaveBeenCalled();
    });

    it('should report how many records the club actually holds', async () => {
      stubHappyPath();

      const result = await service.getSummary();

      expect(result.dbsChecks).toBe(mockDbsStats.total);
      expect(result.consentRecords).toBe(mockConsentStats.total);
    });

    it('should score consent against members rather than consent rows', async () => {
      stubHappyPath();
      // One member of a hundred, fully consented. Scoring the three consent
      // rows on their own would award full marks for the consent half.
      mockMembersService.getStatistics.mockResolvedValue({ total: 100 });
      mockConsentsService.getCoverage.mockResolvedValue({
        requiredTypes: 3,
        complete: 1,
        partial: 0,
      });
      mockConsentsService.getStatistics.mockResolvedValue({
        total: 3,
        granted: 3,
        denied: 0,
        pending: 0,
        revoked: 0,
        byType: {},
      });

      const result = await service.getSummary();

      // DBS contributes 30 of its 40 and costs 5 of the 20 penalty; consent
      // contributes 0.4 of its 40. Anything near the full 40 would mean the
      // score is still counting rows.
      expect(result.consentMissing).toBe(99);
      expect(result.healthScore).toBeLessThan(30);
    });

    it('should count consent complete and partial from per-member coverage', async () => {
      stubHappyPath();

      const result = await service.getSummary();

      expect(result.consentComplete).toBe(mockConsentCoverage.complete);
      expect(result.consentPartial).toBe(mockConsentCoverage.partial);
    });

    it('should treat members with no consent on file as missing', async () => {
      stubHappyPath();

      const result = await service.getSummary();

      // 20 members, 12 complete, 5 partial, so 3 have nothing on file.
      expect(result.consentMissing).toBe(3);
      expect(result.consentComplete + result.consentPartial + result.consentMissing).toBe(
        mockMemberStats.total,
      );
    });

    it('should not report a negative missing count when coverage exceeds the member total', async () => {
      stubHappyPath();
      // Consents can outlive the member row they belong to in a partly
      // imported club; the count must never go below zero.
      mockMembersService.getStatistics.mockResolvedValue({ total: 10 });

      const result = await service.getSummary();

      expect(result.consentMissing).toBe(0);
    });

    it('should report zero consent coverage for a club with no records', async () => {
      stubHappyPath();
      mockConsentsService.getCoverage.mockResolvedValue({
        requiredTypes: 3,
        complete: 0,
        partial: 0,
      });
      mockMembersService.getStatistics.mockResolvedValue({ total: 0 });

      const result = await service.getSummary();

      expect(result.consentComplete).toBe(0);
      expect(result.consentPartial).toBe(0);
      expect(result.consentMissing).toBe(0);
    });

    it('should return every safeguarding officer, not just the first', async () => {
      stubHappyPath();

      const result = await service.getSummary();

      expect(result.safeguardingOfficers).toHaveLength(2);
      expect(result.safeguardingOfficers.map((officer) => officer.name)).toEqual([
        'Sarah Mitchell',
        'Aled Prosser',
      ]);
      expect(result.safeguardingOfficer?.name).toBe('Sarah Mitchell');
      expect(result.safeguardingOfficer?.role).toBe('Welfare Officer');
      expect(result.safeguardingOfficer?.email).toBe('welfare@gymclub.org.uk');
    });

    it('should flag an officer whose own check expires within the warning window', async () => {
      stubHappyPath();

      const result = await service.getSummary();

      const [primary, deputy] = result.safeguardingOfficers;
      expect(primary.checkStatus).toBe('valid');
      expect(deputy.checkStatus).toBe('expiring');
      expect(deputy.daysRemaining).toBeLessThanOrEqual(30);
      expect(deputy.daysRemaining).toBeGreaterThan(0);
    });

    it('should flag an officer whose own check has already expired', async () => {
      stubHappyPath();
      mockSafeguardingService.getOfficers.mockResolvedValue([
        { ...mockOfficers[0], dbs_expiry: daysFromNow(-10) },
      ]);

      const result = await service.getSummary();

      expect(result.safeguardingOfficers[0].checkStatus).toBe('expired');
      expect(result.safeguardingOfficers[0].daysRemaining).toBeLessThan(0);
    });

    it('should mark an officer with no recorded expiry as unknown rather than valid', async () => {
      stubHappyPath();
      mockSafeguardingService.getOfficers.mockResolvedValue([
        { ...mockOfficers[0], dbs_expiry: null },
      ]);

      const result = await service.getSummary();

      expect(result.safeguardingOfficers[0].checkStatus).toBe('unknown');
      expect(result.safeguardingOfficers[0].daysRemaining).toBeNull();
      expect(result.safeguardingOfficers[0].dbsExpiry).toBe('');
    });

    it('should accept a date-only expiry string from the pg driver', async () => {
      stubHappyPath();
      mockSafeguardingService.getOfficers.mockResolvedValue([
        { ...mockOfficers[0], dbs_expiry: '2099-10-02' },
      ]);

      const result = await service.getSummary();

      expect(result.safeguardingOfficers[0].dbsExpiry).toContain('2099-10-02');
      expect(result.safeguardingOfficers[0].checkStatus).toBe('valid');
    });

    it('should set safeguardingOfficer to null when no officers exist', async () => {
      stubHappyPath();
      mockSafeguardingService.getOfficers.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.safeguardingOfficer).toBeNull();
      expect(result.safeguardingOfficers).toEqual([]);
    });

    it('should include expiring DBS checks in the summary', async () => {
      stubHappyPath();

      const result = await service.getSummary();

      expect(result.expiringDbsChecks).toBeDefined();
      expect(result.expiringDbsChecks.length).toBe(1);
      expect(result.expiringDbsChecks[0].name).toBe('John Smith');
      expect(result.expiringDbsChecks[0].daysRemaining).toBeGreaterThanOrEqual(0);
    });

    it('should not report a check that has already lapsed as expiring today', async () => {
      stubHappyPath();
      // The expiry query has no lower bound, so a check nobody renewed comes
      // back in this list; flattening it to zero would read as "expires today".
      mockDBSService.getExpiringSoon.mockResolvedValue([
        { ...mockExpiringDbs[0], expiry_date: daysFromNow(-400) },
      ]);

      const result = await service.getSummary();

      expect(result.expiringDbsChecks[0].daysRemaining).toBeLessThan(-390);
    });

    it('should calculate a health score of 0 when there are no records', async () => {
      stubHappyPath();
      mockDBSService.getStatistics.mockResolvedValue({
        total: 0,
        valid: 0,
        expiringSoon: 0,
        expired: 0,
        pending: 0,
      });
      mockDBSService.getExpiringSoon.mockResolvedValue([]);
      mockConsentsService.getStatistics.mockResolvedValue({
        total: 0,
        granted: 0,
        denied: 0,
        pending: 0,
        revoked: 0,
        byType: {},
      });
      mockConsentsService.getCoverage.mockResolvedValue({
        requiredTypes: 3,
        complete: 0,
        partial: 0,
      });
      mockMembersService.getStatistics.mockResolvedValue({ total: 0 });
      mockSafeguardingService.getOfficers.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.healthScore).toBe(0);
    });

    it('should fetch DBS checks expiring within 90 days', async () => {
      stubHappyPath();
      mockDBSService.getExpiringSoon.mockResolvedValue([]);

      await service.getSummary();

      expect(mockDBSService.getExpiringSoon).toHaveBeenCalledWith(90);
    });

    it('should re-throw errors from sub-services', async () => {
      stubHappyPath();
      mockDBSService.getStatistics.mockRejectedValue(new Error('Database error'));

      await expect(service.getSummary()).rejects.toThrow('Database error');
    });
  });
});
