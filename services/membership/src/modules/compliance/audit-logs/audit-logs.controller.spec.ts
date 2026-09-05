import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuditAction, AuditEntityType } from './entities/audit-log.entity';

describe('AuditLogsController', () => {
  let controller: AuditLogsController;

  const mockAuditLog = {
    audit_log_id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '223e4567-e89b-12d3-a456-426614174001',
    user_email: 'coach@swimclub.org.uk',
    action: AuditAction.CREATE,
    entity_type: AuditEntityType.MEMBER,
    entity_id: '333e4567-e89b-12d3-a456-426614174002',
    description: 'Created a new member record',
    created_at: new Date(),
  };

  const mockAuditLogsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByUser: jest.fn(),
    findByEntity: jest.fn(),
    findByAction: jest.fn(),
    findByDateRange: jest.fn(),
    findRecent: jest.fn(),
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [{ provide: AuditLogsService, useValue: mockAuditLogsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditLogsController>(AuditLogsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return audit logs with default limit and offset', async () => {
      mockAuditLogsService.findAll.mockResolvedValue([mockAuditLog]);

      const result = await controller.findAll();

      expect(result).toEqual([mockAuditLog]);
      expect(mockAuditLogsService.findAll).toHaveBeenCalledWith(100, 0);
    });

    it('should pass custom limit and offset query parameters', async () => {
      mockAuditLogsService.findAll.mockResolvedValue([]);

      await controller.findAll(50, 10);

      expect(mockAuditLogsService.findAll).toHaveBeenCalledWith(50, 10);
    });
  });

  describe('getStatistics', () => {
    it('should return audit log statistics', async () => {
      const mockStats = { total: 500, byAction: {}, byEntityType: {} };
      mockAuditLogsService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(result).toEqual(mockStats);
    });
  });

  describe('findRecent', () => {
    it('should return recent audit logs with default hours', async () => {
      mockAuditLogsService.findRecent.mockResolvedValue([mockAuditLog]);

      const result = await controller.findRecent();

      expect(result).toEqual([mockAuditLog]);
      expect(mockAuditLogsService.findRecent).toHaveBeenCalledWith(24);
    });

    it('should pass custom hours parameter', async () => {
      mockAuditLogsService.findRecent.mockResolvedValue([]);

      await controller.findRecent(48);

      expect(mockAuditLogsService.findRecent).toHaveBeenCalledWith(48);
    });
  });

  describe('findByUser', () => {
    it('should return audit logs for a specific user', async () => {
      mockAuditLogsService.findByUser.mockResolvedValue([mockAuditLog]);

      const result = await controller.findByUser(mockAuditLog.user_id);

      expect(result).toEqual([mockAuditLog]);
      expect(mockAuditLogsService.findByUser).toHaveBeenCalledWith(mockAuditLog.user_id, 100);
    });
  });

  describe('findByEntity', () => {
    it('should return audit logs for a specific entity', async () => {
      mockAuditLogsService.findByEntity.mockResolvedValue([mockAuditLog]);

      const result = await controller.findByEntity(AuditEntityType.MEMBER, mockAuditLog.entity_id);

      expect(result).toEqual([mockAuditLog]);
      expect(mockAuditLogsService.findByEntity).toHaveBeenCalledWith(
        AuditEntityType.MEMBER,
        mockAuditLog.entity_id,
        100,
      );
    });
  });

  describe('findByAction', () => {
    it('should return audit logs for a specific action', async () => {
      mockAuditLogsService.findByAction.mockResolvedValue([mockAuditLog]);

      const result = await controller.findByAction(AuditAction.CREATE);

      expect(result).toEqual([mockAuditLog]);
      expect(mockAuditLogsService.findByAction).toHaveBeenCalledWith(AuditAction.CREATE, 100);
    });
  });

  describe('findByDateRange', () => {
    it('should return audit logs within a date range', async () => {
      mockAuditLogsService.findByDateRange.mockResolvedValue([mockAuditLog]);

      const result = await controller.findByDateRange('2026-01-01', '2026-03-31');

      expect(result).toEqual([mockAuditLog]);
      expect(mockAuditLogsService.findByDateRange).toHaveBeenCalledWith(
        new Date('2026-01-01'),
        new Date('2026-03-31'),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single audit log entry', async () => {
      mockAuditLogsService.findOne.mockResolvedValue(mockAuditLog);

      const result = await controller.findOne(mockAuditLog.audit_log_id);

      expect(result).toEqual(mockAuditLog);
    });
  });
});
