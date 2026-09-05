import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsentsService } from './consents.service';
import { ConsentsRepository } from './consents.repository';
import { Consent, ConsentType, ConsentStatus } from './entities/consent.entity';
import { EmailService } from '../../email/email.service';
import { ClsService } from 'nestjs-cls';
import { ClubsService } from '../../clubs/clubs.service';

describe('ConsentsService', () => {
  let service: ConsentsService;

  const mockClubsService = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockConsent: Partial<Consent> = {
    consent_id: '123e4567-e89b-12d3-a456-426614174000',
    swimmer_id: '223e4567-e89b-12d3-a456-426614174001',
    consent_type: ConsentType.PHOTOGRAPHY,
    status: ConsentStatus.GRANTED,
    granted_by_user_id: '333e4567-e89b-12d3-a456-426614174002',
    granted_date: new Date(),
    expiry_date: undefined,
    notes: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySwimmer: jest.fn(),
    findBySwimmerAndType: jest.fn(),
    findByType: jest.fn(),
    findPendingConsents: jest.fn(),
    findExpiringConsents: jest.fn(),
    update: jest.fn(),
    revokeConsent: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    countByStatus: jest.fn(),
    countByType: jest.fn(),
  };

  const mockEmailService = {
    sendConsentExpiryWarning: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsService,
        { provide: ConsentsRepository, useValue: mockRepository },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ClubsService, useValue: mockClubsService },
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

    service = module.get<ConsentsService>(ConsentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a consent record', async () => {
      const createDto = {
        swimmer_id: mockConsent.swimmer_id as string,
        consent_type: ConsentType.PHOTOGRAPHY,
        granted_by_user_id: mockConsent.granted_by_user_id as string,
      };

      mockRepository.findBySwimmerAndType.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockConsent);

      const result = await service.create(createDto as any);

      expect(result).toEqual(mockConsent);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw ConflictException if swimmer already has a granted consent of the same type', async () => {
      const createDto = {
        swimmer_id: mockConsent.swimmer_id as string,
        consent_type: ConsentType.PHOTOGRAPHY,
        granted_by_user_id: mockConsent.granted_by_user_id as string,
      };

      mockRepository.findBySwimmerAndType.mockResolvedValue({
        ...mockConsent,
        status: ConsentStatus.GRANTED,
      });

      await expect(service.create(createDto as any)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should allow creation if existing consent is not granted', async () => {
      const createDto = {
        swimmer_id: mockConsent.swimmer_id as string,
        consent_type: ConsentType.PHOTOGRAPHY,
        granted_by_user_id: mockConsent.granted_by_user_id as string,
      };

      mockRepository.findBySwimmerAndType.mockResolvedValue({
        ...mockConsent,
        status: ConsentStatus.REVOKED,
      });
      mockRepository.create.mockResolvedValue(mockConsent);

      const result = await service.create(createDto as any);

      expect(result).toEqual(mockConsent);
    });
  });

  describe('findAll', () => {
    it('should return all consent records', async () => {
      mockRepository.findAll.mockResolvedValue([mockConsent]);

      const result = await service.findAll();

      expect(result).toEqual([mockConsent]);
    });
  });

  describe('findOne', () => {
    it('should return a single consent record', async () => {
      mockRepository.findOne.mockResolvedValue(mockConsent);

      const result = await service.findOne(mockConsent.consent_id as string);

      expect(result).toEqual(mockConsent);
    });

    it('should throw NotFoundException if consent does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySwimmer', () => {
    it('should return consents for a specific swimmer', async () => {
      mockRepository.findBySwimmer.mockResolvedValue([mockConsent]);

      const result = await service.findBySwimmer(mockConsent.swimmer_id as string);

      expect(result).toEqual([mockConsent]);
      expect(mockRepository.findBySwimmer).toHaveBeenCalledWith(mockConsent.swimmer_id);
    });
  });

  describe('getSwimmerConsentStatus', () => {
    it('should return consent status for all types', async () => {
      mockRepository.findBySwimmer.mockResolvedValue([
        { ...mockConsent, consent_type: ConsentType.PHOTOGRAPHY, status: ConsentStatus.GRANTED },
        { ...mockConsent, consent_type: ConsentType.VIDEO, status: ConsentStatus.DENIED },
      ]);

      const result = await service.getSwimmerConsentStatus(mockConsent.swimmer_id as string);

      expect(result[ConsentType.PHOTOGRAPHY]).toBe(true);
      expect(result[ConsentType.VIDEO]).toBe(false);
      expect(result[ConsentType.MEDICAL_TREATMENT]).toBe(false);
    });
  });

  describe('hasConsent', () => {
    it('should return true when swimmer has a granted, non-expired consent', async () => {
      mockRepository.findBySwimmerAndType.mockResolvedValue({
        ...mockConsent,
        status: ConsentStatus.GRANTED,
        expiry_date: null,
      });

      const result = await service.hasConsent(
        mockConsent.swimmer_id as string,
        ConsentType.PHOTOGRAPHY,
      );

      expect(result).toBe(true);
    });

    it('should return false when no consent exists', async () => {
      mockRepository.findBySwimmerAndType.mockResolvedValue(null);

      const result = await service.hasConsent(
        mockConsent.swimmer_id as string,
        ConsentType.PHOTOGRAPHY,
      );

      expect(result).toBe(false);
    });

    it('should return false when consent is expired', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      mockRepository.findBySwimmerAndType.mockResolvedValue({
        ...mockConsent,
        status: ConsentStatus.GRANTED,
        expiry_date: pastDate,
      });

      const result = await service.hasConsent(
        mockConsent.swimmer_id as string,
        ConsentType.PHOTOGRAPHY,
      );

      expect(result).toBe(false);
    });

    it('should return false when consent status is not granted', async () => {
      mockRepository.findBySwimmerAndType.mockResolvedValue({
        ...mockConsent,
        status: ConsentStatus.DENIED,
      });

      const result = await service.hasConsent(
        mockConsent.swimmer_id as string,
        ConsentType.PHOTOGRAPHY,
      );

      expect(result).toBe(false);
    });
  });

  describe('revokeConsent', () => {
    it('should revoke a granted consent', async () => {
      const revokedConsent = { ...mockConsent, status: ConsentStatus.REVOKED };

      mockRepository.findOne.mockResolvedValue(mockConsent);
      mockRepository.revokeConsent.mockResolvedValue(revokedConsent);

      const result = await service.revokeConsent(
        mockConsent.consent_id as string,
        'revoking-user-id',
      );

      expect(result.status).toBe(ConsentStatus.REVOKED);
      expect(mockRepository.revokeConsent).toHaveBeenCalledWith(
        mockConsent.consent_id,
        'revoking-user-id',
      );
    });

    it('should throw ConflictException if consent is not granted', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockConsent,
        status: ConsentStatus.PENDING,
      });

      await expect(
        service.revokeConsent(mockConsent.consent_id as string, 'revoking-user-id'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a consent record', async () => {
      const updateDto = { notes: 'Updated notes' };
      const updatedConsent = { ...mockConsent, notes: 'Updated notes' };

      mockRepository.findOne.mockResolvedValue(mockConsent);
      mockRepository.update.mockResolvedValue(updatedConsent);

      const result = await service.update(mockConsent.consent_id as string, updateDto as any);

      expect(result.notes).toBe('Updated notes');
    });

    it('should throw NotFoundException if consent does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent-id', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a consent record', async () => {
      mockRepository.findOne.mockResolvedValue(mockConsent);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockConsent.consent_id as string);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockConsent.consent_id);
    });

    it('should throw NotFoundException if consent does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should return aggregated consent statistics', async () => {
      mockRepository.count.mockResolvedValue(100);
      mockRepository.countByStatus.mockImplementation((status: ConsentStatus) => {
        const counts = {
          [ConsentStatus.GRANTED]: 60,
          [ConsentStatus.DENIED]: 10,
          [ConsentStatus.PENDING]: 20,
          [ConsentStatus.REVOKED]: 10,
        } as Record<string, number>;
        return Promise.resolve(counts[status] || 0);
      });
      mockRepository.countByType.mockResolvedValue(12);

      const result = await service.getStatistics();

      expect(result.total).toBe(100);
      expect(result.granted).toBe(60);
      expect(result.denied).toBe(10);
      expect(result.pending).toBe(20);
      expect(result.revoked).toBe(10);
      expect(result.byType).toBeDefined();
    });
  });

  describe('getPendingConsents', () => {
    it('should return pending consents', async () => {
      const pendingConsent = { ...mockConsent, status: ConsentStatus.PENDING };
      mockRepository.findPendingConsents.mockResolvedValue([pendingConsent]);

      const result = await service.getPendingConsents();

      expect(result).toEqual([pendingConsent]);
      expect(mockRepository.findPendingConsents).toHaveBeenCalled();
    });
  });

  describe('getExpiringConsents', () => {
    it('should return consents expiring within the specified period', async () => {
      mockRepository.findExpiringConsents.mockResolvedValue([mockConsent]);

      const result = await service.getExpiringConsents(30);

      expect(result).toEqual([mockConsent]);
      expect(mockRepository.findExpiringConsents).toHaveBeenCalledWith(30);
    });

    it('should default to 30 days when no parameter is provided', async () => {
      mockRepository.findExpiringConsents.mockResolvedValue([]);

      await service.getExpiringConsents();

      expect(mockRepository.findExpiringConsents).toHaveBeenCalledWith(30);
    });
  });

  describe('checkExpiredConsents expiry warning emails', () => {
    // Expiry date chosen to fall exactly 7 days ahead so the warning fires.
    const buildExpiringConsent = (): Partial<Consent> => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      return {
        ...mockConsent,
        consent_type: ConsentType.PHOTOGRAPHY,
        status: ConsentStatus.GRANTED,
        expiry_date: expiry,
        granted_by: { first_name: 'Alex', last_name: 'Jones', email: 'alex@example.com' } as any,
        swimmer: { first_name: 'Sam', last_name: 'Jones', dob: new Date('2012-05-01') } as any,
      };
    };

    const runCronForClub = async (club: {
      id: string;
      locale: string;
      timezone: string;
      governing_body?: string | null;
    }): Promise<void> => {
      mockClubsService.findAll.mockResolvedValue([club]);
      const expiring = buildExpiringConsent();
      mockRepository.findExpiringConsents.mockResolvedValue([expiring]);
      // No expired consents to mark in this sweep.
      mockRepository.findAll.mockResolvedValue([]);

      await service.checkExpiredConsents();
      // The warning email is dispatched fire-and-forget, so flush the queue.
      await new Promise((resolve) => setImmediate(resolve));
    };

    it('formats the expiry date in en-GB for a GB club (unchanged UK output)', async () => {
      await runCronForClub({ id: 'club-gb', locale: 'en-GB', timezone: 'Europe/London' });

      expect(mockEmailService.sendConsentExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendConsentExpiryWarning.mock.calls[0][0];
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      // Date-only column: formatted in UTC. For an en-GB (Europe/London) club
      // the day/month/year output is the previous UK format.
      const expected = expiry.toLocaleDateString('en-GB', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      expect(payload.expiringConsents[0].expiryDate).toBe(expected);
    });

    it('formats the expiry date in the club locale for a non-GB club', async () => {
      await runCronForClub({ id: 'club-us', locale: 'en-US', timezone: 'America/New_York' });

      expect(mockEmailService.sendConsentExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendConsentExpiryWarning.mock.calls[0][0];
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      // expiry_date is a date-only column, so the locale changes but the
      // timezone stays UTC to avoid shifting the day for clubs west of UTC.
      const expected = expiry.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      expect(payload.expiringConsents[0].expiryDate).toBe(expected);
    });

    it('uses the byte-identical GDPR/Swim England compliance wording for a GB club', async () => {
      await runCronForClub({
        id: 'club-gb',
        locale: 'en-GB',
        timezone: 'Europe/London',
        governing_body: 'SWIM_ENGLAND',
      });

      expect(mockEmailService.sendConsentExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendConsentExpiryWarning.mock.calls[0][0];
      expect(payload.complianceRequirements).toBe(
        'GDPR and Swim England Wavepower requirements',
      );
    });

    it('uses privacy-law/Safe Sport compliance wording for a US club', async () => {
      await runCronForClub({
        id: 'club-us',
        locale: 'en-US',
        timezone: 'America/New_York',
        governing_body: 'USA_SWIMMING',
      });

      expect(mockEmailService.sendConsentExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendConsentExpiryWarning.mock.calls[0][0];
      expect(payload.complianceRequirements).toBe(
        'applicable privacy law and USA Swimming Safe Sport requirements',
      );
    });

    it('cites the Privacy Act 1988 for an Australian club', async () => {
      await runCronForClub({
        id: 'club-au',
        locale: 'en-AU',
        timezone: 'Australia/Sydney',
        governing_body: 'SWIMMING_AUSTRALIA',
      });

      expect(mockEmailService.sendConsentExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendConsentExpiryWarning.mock.calls[0][0];
      expect(payload.complianceRequirements).toBe(
        'the Privacy Act 1988 (Australian Privacy Principles) and Swimming Australia Safe Sport requirements',
      );
    });

    it('cites PIPEDA for a Canadian club', async () => {
      await runCronForClub({
        id: 'club-ca',
        locale: 'en-CA',
        timezone: 'America/Toronto',
        governing_body: 'SWIMMING_CANADA',
      });

      expect(mockEmailService.sendConsentExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendConsentExpiryWarning.mock.calls[0][0];
      expect(payload.complianceRequirements).toBe(
        'PIPEDA and Swimming Canada Safe Sport requirements',
      );
    });

    it('names the data-sharing recipient in the expiring consent list', async () => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      mockClubsService.findAll.mockResolvedValue([
        {
          id: 'club-au',
          locale: 'en-AU',
          timezone: 'Australia/Sydney',
          governing_body: 'SWIMMING_AUSTRALIA',
        },
      ]);
      mockRepository.findExpiringConsents.mockResolvedValue([
        {
          ...buildExpiringConsent(),
          consent_type: ConsentType.DATA_SHARING,
        },
      ]);
      mockRepository.findAll.mockResolvedValue([]);

      await service.checkExpiredConsents();
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockEmailService.sendConsentExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendConsentExpiryWarning.mock.calls[0][0];
      expect(payload.expiringConsents[0].name).toBe('Data Sharing with Swimming Australia');
    });

    it('falls back to the British Gymnastics wording when a club has no governing body set', async () => {
      await runCronForClub({ id: 'club-legacy', locale: 'en-GB', timezone: 'Europe/London' });

      expect(mockEmailService.sendConsentExpiryWarning).toHaveBeenCalledTimes(1);
      const payload = mockEmailService.sendConsentExpiryWarning.mock.calls[0][0];
      expect(payload.complianceRequirements).toBe(
        'GDPR and British Gymnastics Safeguarding and Protecting Children Policy requirements',
      );
    });
  });
});
