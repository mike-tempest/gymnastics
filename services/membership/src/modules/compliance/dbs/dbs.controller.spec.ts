import { Test, TestingModule } from '@nestjs/testing';
import { DBSController } from './dbs.controller';
import { DBSService } from './dbs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { DBSStatus, DBSCheckType } from './entities/dbs-check.entity';

describe('DBSController', () => {
  let controller: DBSController;
  let mockService: any;

  const mockDBSCheck = {
    dbs_check_id: 'dbs-uuid-1',
    user_id: 'user-uuid-1',
    certificate_number: 'DBS-001',
    check_type: DBSCheckType.ENHANCED,
    status: DBSStatus.VALID,
    issue_date: new Date('2024-01-01'),
    expiry_date: new Date('2027-01-01'),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockService = {
      create: jest.fn().mockResolvedValue(mockDBSCheck),
      findAll: jest.fn().mockResolvedValue([mockDBSCheck]),
      findOne: jest.fn().mockResolvedValue(mockDBSCheck),
      findByUser: jest.fn().mockResolvedValue([mockDBSCheck]),
      getLatestForUser: jest.fn().mockResolvedValue(mockDBSCheck),
      isUserDBSValid: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(mockDBSCheck),
      remove: jest.fn().mockResolvedValue(undefined),
      getStatistics: jest
        .fn()
        .mockResolvedValue({ total: 10, valid: 5, expiringSoon: 2, expired: 1, pending: 2 }),
      getExpiringSoon: jest.fn().mockResolvedValue([mockDBSCheck]),
      getExpired: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DBSController],
      providers: [{ provide: DBSService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DBSController>(DBSController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a DBS check', async () => {
      const dto = { user_id: 'user-uuid-1', certificate_number: 'DBS-002' };
      const req = { user: { user_id: 'admin-uuid-1' } };
      const result = await controller.create(dto as any, req);
      expect(result).toEqual(mockDBSCheck);
      expect(mockService.create).toHaveBeenCalledWith(dto, 'admin-uuid-1');
    });
  });

  describe('findAll', () => {
    it('should return all DBS checks', async () => {
      const result = await controller.findAll();
      expect(result).toEqual([mockDBSCheck]);
    });
  });

  describe('getStatistics', () => {
    it('should return DBS statistics', async () => {
      const result = await controller.getStatistics();
      expect(result.total).toBe(10);
    });
  });

  describe('getExpiringSoon', () => {
    it('should return expiring DBS checks', async () => {
      const result = await controller.getExpiringSoon();
      expect(result).toEqual([mockDBSCheck]);
    });
  });

  describe('getExpired', () => {
    it('should return expired DBS checks', async () => {
      const result = await controller.getExpired();
      expect(result).toEqual([]);
    });
  });

  describe('findByUser', () => {
    it('should return DBS checks for a user', async () => {
      const result = await controller.findByUser('user-uuid-1');
      expect(result).toEqual([mockDBSCheck]);
      expect(mockService.findByUser).toHaveBeenCalledWith('user-uuid-1');
    });
  });

  describe('getLatestForUser', () => {
    it('should return the latest DBS check for a user', async () => {
      const result = await controller.getLatestForUser('user-uuid-1');
      expect(result).toEqual(mockDBSCheck);
    });
  });

  describe('isUserValid', () => {
    it('should return validity status', async () => {
      const result = await controller.isUserValid('user-uuid-1');
      expect(result).toEqual({ user_id: 'user-uuid-1', is_dbs_valid: true });
    });
  });

  describe('findOne', () => {
    it('should return a single DBS check', async () => {
      const result = await controller.findOne('dbs-uuid-1');
      expect(result).toEqual(mockDBSCheck);
    });
  });

  describe('update', () => {
    it('should update a DBS check', async () => {
      const dto = { notes: 'Updated' };
      const req = { user: { user_id: 'admin-uuid-1' } };
      const result = await controller.update('dbs-uuid-1', dto as any, req);
      expect(result).toEqual(mockDBSCheck);
      expect(mockService.update).toHaveBeenCalledWith('dbs-uuid-1', dto, 'admin-uuid-1');
    });
  });

  describe('remove', () => {
    it('should remove a DBS check', async () => {
      const result = await controller.remove('dbs-uuid-1');
      expect(result).toEqual({ message: 'DBS check deleted successfully' });
      expect(mockService.remove).toHaveBeenCalledWith('dbs-uuid-1');
    });
  });
});
