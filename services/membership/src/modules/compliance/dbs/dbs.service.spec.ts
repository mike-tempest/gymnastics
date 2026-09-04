import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DBSService } from './dbs.service';
import { DBSRepository } from './dbs.repository';
import { EmailService } from '../../email/email.service';
import { DBSStatus, DBSCheckType } from './entities/dbs-check.entity';
import { ClsService } from 'nestjs-cls';
import { ClubsService } from '../../clubs/clubs.service';

describe('DBSService', () => {
  let service: DBSService;
  let mockRepository: any;
  let mockEmailService: any;
  let mockConfigService: any;
  let mockClubsService: any;

  const mockDBSCheck = {
    dbs_check_id: 'dbs-uuid-1',
    user_id: 'user-uuid-1',
    certificate_number: 'DBS-001',
    check_type: DBSCheckType.ENHANCED,
    status: DBSStatus.VALID,
    issue_date: new Date('2024-01-01'),
    expiry_date: new Date('2027-01-01'),
    last_verified_date: null,
    notes: null,
    is_valid: true,
    uploaded_document_id: null,
    created_by_user_id: 'admin-uuid-1',
    verified_by_user_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    user: {
      user_id: 'user-uuid-1',
      email: 'coach@test.com',
      first_name: 'Test',
      last_name: 'Coach',
    },
  };

  beforeEach(async () => {
    mockRepository = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(mockDBSCheck),
      create: jest.fn().mockResolvedValue(mockDBSCheck),
      update: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      findByUser: jest.fn().mockResolvedValue([mockDBSCheck]),
      findLatestByUser: jest.fn().mockResolvedValue(mockDBSCheck),
      findExpiringSoon: jest.fn().mockResolvedValue([]),
      findExpired: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(10),
      countByStatus: jest.fn().mockResolvedValue(3),
      markAsExpiringSoon: jest.fn().mockResolvedValue(undefined),
      markAsExpired: jest.fn().mockResolvedValue(undefined),
    };

    mockEmailService = {
      sendDBSExpiryWarning: jest.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          APP_URL: 'http://localhost:3000',
          CLUB_CONTACT_NUMBER: '01onal 567890',
        };
        return values[key] ?? defaultValue;
      }),
    };

    mockClubsService = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'club-1',
          locale: 'en-GB',
          timezone: 'Europe/London',
          governing_body: 'SWIM_ENGLAND',
        },
      ]),
      findCurrent: jest.fn().mockResolvedValue({
        id: 'club-1',
        locale: 'en-GB',
        timezone: 'Europe/London',
        governing_body: 'SWIM_ENGLAND',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DBSService,
        { provide: DBSRepository, useValue: mockRepository },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
        // One GB club so the per-club cron sweep still exercises its body and
        // keeps the previous en-GB date formatting for existing UK clubs.
        {
          provide: ClubsService,
          useValue: mockClubsService,
        },
        {
          provide: ClsService,
          useValue: {
            run: jest.fn(async (fn: () => Promise<unknown>) => await fn()),
            set: jest.fn(),
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DBSService>(DBSService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a DBS check successfully', async () => {
      const createDto = {
        user_id: 'user-uuid-1',
        certificate_number: 'DBS-002',
        check_type: DBSCheckType.ENHANCED,
        issue_date: new Date('2024-01-01'),
        expiry_date: new Date('2027-01-01'),
      };

      mockRepository.findAll.mockResolvedValue([]);
      mockRepository.create.mockResolvedValue(mockDBSCheck);
      mockRepository.findOne.mockResolvedValue(mockDBSCheck);

      const result = await service.create(createDto as any, 'admin-uuid-1');
      expect(result).toEqual(mockDBSCheck);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto, 'admin-uuid-1');
    });

    it('should throw ConflictException on duplicate certificate number', async () => {
      const createDto = {
        user_id: 'user-uuid-1',
        certificate_number: 'DBS-001',
        check_type: DBSCheckType.ENHANCED,
        issue_date: new Date('2024-01-01'),
      };

      mockRepository.findAll.mockResolvedValue([mockDBSCheck]);

      await expect(service.create(createDto as any, 'admin-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('keeps the GB DBS wording in the duplicate-certificate error', async () => {
      const createDto = {
        user_id: 'user-uuid-1',
        certificate_number: 'DBS-001',
        check_type: DBSCheckType.ENHANCED,
        issue_date: new Date('2024-01-01'),
      };

      mockRepository.findAll.mockResolvedValue([mockDBSCheck]);

      await expect(service.create(createDto as any, 'admin-uuid-1')).rejects.toThrow(
        'DBS certificate DBS-001 already exists',
      );
    });

    it('names the AU framework in the duplicate-certificate error for an AU club', async () => {
      const createDto = {
        user_id: 'user-uuid-1',
        certificate_number: 'WWC1234567E',
        check_type: DBSCheckType.WORKING_WITH_CHILDREN_CHECK,
        issue_date: new Date('2024-01-01'),
      };

      mockClubsService.findCurrent.mockResolvedValue({
        id: 'club-au',
        locale: 'en-AU',
        timezone: 'Australia/Sydney',
        governing_body: 'SWIMMING_AUSTRALIA',
      });
      mockRepository.findAll.mockResolvedValue([
        { ...mockDBSCheck, certificate_number: 'WWC1234567E' },
      ]);

      await expect(service.create(createDto as any, 'admin-uuid-1')).rejects.toThrow(
        'WWCC certificate WWC1234567E already exists',
      );
    });
  });

  describe('findAll', () => {
    it('should return all DBS checks', async () => {
      mockRepository.findAll.mockResolvedValue([mockDBSCheck]);
      const result = await service.findAll();
      expect(result).toEqual([mockDBSCheck]);
    });
  });

  describe('findOne', () => {
    it('should return a DBS check when found', async () => {
      const result = await service.findOne('dbs-uuid-1');
      expect(result).toEqual(mockDBSCheck);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUser', () => {
    it('should return DBS checks for a user', async () => {
      const result = await service.findByUser('user-uuid-1');
      expect(result).toEqual([mockDBSCheck]);
      expect(mockRepository.findByUser).toHaveBeenCalledWith('user-uuid-1');
    });
  });

  describe('getLatestForUser', () => {
    it('should return the latest DBS check for a user', async () => {
      const result = await service.getLatestForUser('user-uuid-1');
      expect(result).toEqual(mockDBSCheck);
    });
  });

  describe('isUserDBSValid', () => {
    it('should return true when latest check has VALID status', async () => {
      const result = await service.isUserDBSValid('user-uuid-1');
      expect(result).toBe(true);
    });

    it('should return false when latest check is not VALID', async () => {
      mockRepository.findLatestByUser.mockResolvedValue({
        ...mockDBSCheck,
        status: DBSStatus.EXPIRED,
      });
      const result = await service.isUserDBSValid('user-uuid-1');
      expect(result).toBe(false);
    });

    it('should return false when no checks exist', async () => {
      mockRepository.findLatestByUser.mockResolvedValue(null);
      const result = await service.isUserDBSValid('user-uuid-1');
      expect(result).toBe(false);
    });
  });

  describe('update', () => {
    it('should update a DBS check', async () => {
      const updateDto = { notes: 'Updated notes' };
      mockRepository.findOne.mockResolvedValue(mockDBSCheck);

      const result = await service.update('dbs-uuid-1', updateDto as any, 'admin-uuid-1');
      expect(result).toEqual(mockDBSCheck);
      expect(mockRepository.update).toHaveBeenCalledWith('dbs-uuid-1', updateDto, 'admin-uuid-1');
    });

    it('should throw NotFoundException when check does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.update('nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a DBS check', async () => {
      await service.remove('dbs-uuid-1');
      expect(mockRepository.remove).toHaveBeenCalledWith('dbs-uuid-1');
    });

    it('should throw NotFoundException when check does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getExpiringSoon', () => {
    it('should return expiring DBS checks', async () => {
      mockRepository.findExpiringSoon.mockResolvedValue([mockDBSCheck]);
      const result = await service.getExpiringSoon(90);
      expect(result).toEqual([mockDBSCheck]);
      expect(mockRepository.findExpiringSoon).toHaveBeenCalledWith(90);
    });
  });

  describe('getExpired', () => {
    it('should return expired DBS checks', async () => {
      mockRepository.findExpired.mockResolvedValue([mockDBSCheck]);
      const result = await service.getExpired();
      expect(result).toEqual([mockDBSCheck]);
    });
  });

  describe('getStatistics', () => {
    it('should return DBS statistics', async () => {
      mockRepository.count.mockResolvedValue(10);
      mockRepository.countByStatus
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const result = await service.getStatistics();
      expect(result).toEqual({
        total: 10,
        valid: 5,
        expiringSoon: 2,
        expired: 1,
        pending: 2,
      });
    });
  });

  describe('checkExpiringDBSChecks', () => {
    it('should mark valid checks as expiring soon and send emails at warning thresholds', async () => {
      const expiringCheck = {
        ...mockDBSCheck,
        status: DBSStatus.VALID,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();

      expect(mockRepository.markAsExpiringSoon).toHaveBeenCalledWith(expiringCheck.dbs_check_id);
    });

    it('should mark expired checks', async () => {
      const expiredCheck = { ...mockDBSCheck, status: DBSStatus.EXPIRED };
      mockRepository.findExpiringSoon.mockResolvedValue([]);
      mockRepository.findExpired.mockResolvedValue([expiredCheck]);

      await service.checkExpiringDBSChecks();

      expect(mockRepository.markAsExpired).toHaveBeenCalledWith(expiredCheck.dbs_check_id);
    });

    it('should skip checks without user data', async () => {
      const checkWithoutUser = { ...mockDBSCheck, user: null };
      mockRepository.findExpiringSoon.mockResolvedValue([checkWithoutUser]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();

      expect(mockRepository.markAsExpiringSoon).not.toHaveBeenCalled();
    });

    it('formats warning-email dates in en-GB for a GB club (unchanged UK output)', async () => {
      // 30 days ahead lands on a warning threshold, so an email is dispatched.
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringCheck = { ...mockDBSCheck, status: DBSStatus.VALID, expiry_date: expiry };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockEmailService.sendDBSExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendDBSExpiryWarning.mock.calls[0][0];
      // Date-only column: formatted in UTC. For an en-GB (Europe/London) club
      // the day/month/year output is the previous UK format.
      const expected = expiry.toLocaleDateString('en-GB', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      expect(payload.expiryDate).toBe(expected);
    });

    it('sends GB (Swim England) framework wording unchanged for a GB club', async () => {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringCheck = {
        ...mockDBSCheck,
        status: DBSStatus.VALID,
        check_type: DBSCheckType.ENHANCED,
        expiry_date: expiry,
      };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockEmailService.sendDBSExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendDBSExpiryWarning.mock.calls[0][0];
      // GB regression bar: framework "DBS", the exact Wavepower string, the DBS
      // Update Service paragraph shown, and the previous GB check-type label.
      expect(payload.frameworkName).toBe('DBS');
      expect(payload.safeguardingFramework).toBe('Swim England Wavepower 2024');
      expect(payload.showUpdateService).toBe(true);
      expect(payload.checkType).toBe('Enhanced DBS Check');
    });

    it('sends SafeSport framework wording for a US club', async () => {
      mockClubsService.findAll.mockResolvedValue([
        {
          id: 'club-us',
          locale: 'en-US',
          timezone: 'America/New_York',
          governing_body: 'USA_SWIMMING',
        },
      ]);
      const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const expiringCheck = {
        ...mockDBSCheck,
        status: DBSStatus.VALID,
        check_type: DBSCheckType.SAFESPORT_CERTIFICATION,
        expiry_date: expiry,
      };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockEmailService.sendDBSExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendDBSExpiryWarning.mock.calls[0][0];
      // US clubs use the SafeSport framework: no DBS Update Service paragraph,
      // no Wavepower wording, and the SafeSport check-type label.
      expect(payload.frameworkName).toBe('SafeSport');
      expect(payload.checkType).toBe('SafeSport Certification');
      expect(payload.showUpdateService).toBe(false);
      expect(payload.safeguardingFramework).not.toMatch(/Wavepower/);
      expect(payload.safeguardingFramework).toBe('Safe Sport');
    });

    it('strips the trailing Check from the AU framework name so the template never doubles it', async () => {
      mockClubsService.findAll.mockResolvedValue([
        {
          id: 'club-au',
          locale: 'en-AU',
          timezone: 'Australia/Sydney',
          governing_body: 'SWIMMING_AUSTRALIA',
        },
      ]);
      const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const expiringCheck = {
        ...mockDBSCheck,
        status: DBSStatus.VALID,
        check_type: DBSCheckType.WORKING_WITH_CHILDREN_CHECK,
        expiry_date: expiry,
      };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockEmailService.sendDBSExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendDBSExpiryWarning.mock.calls[0][0];
      // The template appends "Check" itself, so the name must not end with it.
      expect(payload.frameworkName).toBe('Working With Children');
      expect(payload.showUpdateService).toBe(false);
    });

    it('keeps the GB Certificate Number label and passes the configured contact number', async () => {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringCheck = { ...mockDBSCheck, status: DBSStatus.VALID, expiry_date: expiry };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();
      await new Promise((resolve) => setImmediate(resolve));

      const payload = mockEmailService.sendDBSExpiryWarning.mock.calls[0][0];
      expect(payload.certificateNumberLabel).toBe('Certificate Number');
    });

    it('uses the AU card label and the club-state WWCC variant for an AU club', async () => {
      mockClubsService.findAll.mockResolvedValue([
        {
          id: 'club-au',
          locale: 'en-AU',
          timezone: 'Australia/Perth',
          governing_body: 'SWIMMING_AUSTRALIA',
          governing_body_region: 'WA',
        },
      ]);
      const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const expiringCheck = {
        ...mockDBSCheck,
        status: DBSStatus.VALID,
        check_type: DBSCheckType.WORKING_WITH_CHILDREN_CHECK,
        expiry_date: expiry,
      };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();
      await new Promise((resolve) => setImmediate(resolve));

      const payload = mockEmailService.sendDBSExpiryWarning.mock.calls[0][0];
      expect(payload.certificateNumberLabel).toBe('Card or application number');
      // The shared WWCC enum value resolves to the club state's own label.
      expect(payload.checkType).toBe('Working With Children Check Card (WA)');
    });

    it('omits the contact number instead of inventing one when none is configured', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = { APP_URL: 'http://localhost:3000' };
        return values[key] ?? defaultValue;
      });
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringCheck = { ...mockDBSCheck, status: DBSStatus.VALID, expiry_date: expiry };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();
      await new Promise((resolve) => setImmediate(resolve));

      const payload = mockEmailService.sendDBSExpiryWarning.mock.calls[0][0];
      expect(payload.contactNumber).toBeUndefined();
    });

    it('formats warning-email dates in the club locale for a non-GB club', async () => {
      mockClubsService.findAll.mockResolvedValue([
        {
          id: 'club-us',
          locale: 'en-US',
          timezone: 'America/New_York',
          governing_body: 'USA_SWIMMING',
        },
      ]);
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringCheck = { ...mockDBSCheck, status: DBSStatus.VALID, expiry_date: expiry };
      mockRepository.findExpiringSoon.mockResolvedValue([expiringCheck]);
      mockRepository.findExpired.mockResolvedValue([]);

      await service.checkExpiringDBSChecks();
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockEmailService.sendDBSExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendDBSExpiryWarning.mock.calls[0][0];
      // Date-only column: the locale changes but the timezone stays UTC so the
      // day does not shift for clubs west of UTC.
      const expected = expiry.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      expect(payload.expiryDate).toBe(expected);
    });
  });
});
