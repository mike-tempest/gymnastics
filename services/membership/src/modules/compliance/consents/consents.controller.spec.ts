import { Test, TestingModule } from '@nestjs/testing';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ConsentType, ConsentStatus } from './entities/consent.entity';

describe('ConsentsController', () => {
  let controller: ConsentsController;

  const mockConsent = {
    consent_id: '123e4567-e89b-12d3-a456-426614174000',
    member_id: '223e4567-e89b-12d3-a456-426614174001',
    consent_type: ConsentType.PHOTOGRAPHY,
    status: ConsentStatus.GRANTED,
    granted_by_user_id: '333e4567-e89b-12d3-a456-426614174002',
    granted_date: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockConsentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByMember: jest.fn(),
    getMemberConsentStatus: jest.fn(),
    hasConsent: jest.fn(),
    findByType: jest.fn(),
    getPendingConsents: jest.fn(),
    getExpiringConsents: jest.fn(),
    getStatistics: jest.fn(),
    update: jest.fn(),
    revokeConsent: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsentsController],
      providers: [{ provide: ConsentsService, useValue: mockConsentsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConsentsController>(ConsentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call consentsService.create and return the result', async () => {
      const createDto = {
        member_id: mockConsent.member_id,
        consent_type: ConsentType.PHOTOGRAPHY,
        granted_by_user_id: mockConsent.granted_by_user_id,
      };

      mockConsentsService.create.mockResolvedValue(mockConsent);

      const result = await controller.create(createDto as any);

      expect(result).toEqual(mockConsent);
      expect(mockConsentsService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all consents', async () => {
      mockConsentsService.findAll.mockResolvedValue([mockConsent]);

      const result = await controller.findAll();

      expect(result).toEqual([mockConsent]);
    });
  });

  describe('getStatistics', () => {
    it('should return consent statistics', async () => {
      const mockStats = { total: 100, granted: 60, denied: 10, pending: 20, revoked: 10 };
      mockConsentsService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(result).toEqual(mockStats);
    });
  });

  describe('getPendingConsents', () => {
    it('should return pending consents', async () => {
      mockConsentsService.getPendingConsents.mockResolvedValue([mockConsent]);

      const result = await controller.getPendingConsents();

      expect(result).toEqual([mockConsent]);
    });
  });

  describe('getExpiringConsents', () => {
    it('should return expiring consents', async () => {
      mockConsentsService.getExpiringConsents.mockResolvedValue([mockConsent]);

      const result = await controller.getExpiringConsents();

      expect(result).toEqual([mockConsent]);
    });
  });

  describe('findByMember', () => {
    it('should return consents for a specific member', async () => {
      mockConsentsService.findByMember.mockResolvedValue([mockConsent]);

      const result = await controller.findByMember(mockConsent.member_id);

      expect(result).toEqual([mockConsent]);
      expect(mockConsentsService.findByMember).toHaveBeenCalledWith(mockConsent.member_id);
    });
  });

  describe('getMemberConsentStatus', () => {
    it('should return consent status for a member', async () => {
      const mockStatus = { [ConsentType.PHOTOGRAPHY]: true, [ConsentType.VIDEO]: false };
      mockConsentsService.getMemberConsentStatus.mockResolvedValue(mockStatus);

      const result = await controller.getMemberConsentStatus(mockConsent.member_id);

      expect(result).toEqual(mockStatus);
    });
  });

  describe('hasConsent', () => {
    it('should return whether the member has a specific consent', async () => {
      mockConsentsService.hasConsent.mockResolvedValue(true);

      const result = await controller.hasConsent(mockConsent.member_id, ConsentType.PHOTOGRAPHY);

      expect(result).toEqual({
        member_id: mockConsent.member_id,
        consent_type: ConsentType.PHOTOGRAPHY,
        has_consent: true,
      });
    });
  });

  describe('findByType', () => {
    it('should return consents of a specific type', async () => {
      mockConsentsService.findByType.mockResolvedValue([mockConsent]);

      const result = await controller.findByType(ConsentType.PHOTOGRAPHY);

      expect(result).toEqual([mockConsent]);
      expect(mockConsentsService.findByType).toHaveBeenCalledWith(ConsentType.PHOTOGRAPHY);
    });
  });

  describe('findOne', () => {
    it('should return a single consent', async () => {
      mockConsentsService.findOne.mockResolvedValue(mockConsent);

      const result = await controller.findOne(mockConsent.consent_id);

      expect(result).toEqual(mockConsent);
    });
  });

  describe('update', () => {
    it('should update a consent record', async () => {
      const updateDto = { notes: 'Updated' };
      const updated = { ...mockConsent, notes: 'Updated' };
      mockConsentsService.update.mockResolvedValue(updated);

      const result = await controller.update(mockConsent.consent_id, updateDto as any);

      expect(result).toEqual(updated);
      expect(mockConsentsService.update).toHaveBeenCalledWith(mockConsent.consent_id, updateDto);
    });
  });

  describe('revokeConsent', () => {
    it('should revoke a consent using the authenticated user ID', async () => {
      const revokedConsent = { ...mockConsent, status: ConsentStatus.REVOKED };
      mockConsentsService.revokeConsent.mockResolvedValue(revokedConsent);

      const mockReq = { user: { user_id: 'user-123' } };
      const result = await controller.revokeConsent(mockConsent.consent_id, mockReq);

      expect(result).toEqual(revokedConsent);
      expect(mockConsentsService.revokeConsent).toHaveBeenCalledWith(
        mockConsent.consent_id,
        'user-123',
      );
    });
  });

  describe('remove', () => {
    it('should remove a consent and return a success message', async () => {
      mockConsentsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockConsent.consent_id);

      expect(result).toEqual({ message: 'Consent deleted successfully' });
      expect(mockConsentsService.remove).toHaveBeenCalledWith(mockConsent.consent_id);
    });
  });
});
